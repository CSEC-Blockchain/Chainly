import { erc20Abi, getAddress, parseAbi, type Abi, type AbiFunction, type Address } from "viem";
import type { ChainClient } from "./types";
import { NETWORK_NAME, explorerAddressUrl } from "./chain";
import { resolveAddress } from "./ens";
import { BlockchainError, toBlockchainError } from "./errors";
import { explorerName, fetchContractSource, type ContractSource, type ExplorerConfig } from "./explorer";
import { formatToken } from "./format";

/**
 * Explain what a contract is and what it can do, from its verified ABI plus a
 * few onchain probes (works for unverified contracts too, with less detail).
 *
 * The raw source code is never returned: comments and strings in it are
 * attacker-controlled text that could try to steer the agent. ABI-derived
 * names are filtered to plain identifiers for the same reason.
 */

/** EIP-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1). */
const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const probeAbi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

const ERC721_INTERFACE = "0x80ac58cd";
const ERC1155_INTERFACE = "0xd9b67a26";

/** Write functions that usually mean someone holds special powers over the contract. */
const PRIVILEGED: { pattern: RegExp; risk: string }[] = [
  { pattern: /^mint/i, risk: "can create new tokens" },
  { pattern: /^(pause|unpause)$/i, risk: "can freeze or unfreeze the contract" },
  { pattern: /^upgrade/i, risk: "can replace the contract's code" },
  { pattern: /^(transferOwnership|renounceOwnership|setOwner|acceptOwnership)$/i, risk: "can change who controls the contract" },
  { pattern: /^(grantRole|revokeRole|renounceRole)$/i, risk: "can change who has permissions" },
  { pattern: /(blacklist|blocklist|denylist|freeze)/i, risk: "can block specific addresses" },
  { pattern: /^set.*(fee|tax)/i, risk: "can change fees" },
  { pattern: /^(withdraw|sweep|rescue|emergency)/i, risk: "can move funds held by the contract" },
  { pattern: /^burn(From)?$/i, risk: "can destroy tokens" },
];

const MAX_FUNCTIONS = 40;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

export type ContractStandard = "ERC-20" | "ERC-721" | "ERC-1155" | "Ownable" | "AccessControl" | "Pausable" | "Upgradeable proxy";

export async function explainContract(client: ChainClient, addressInput: string, explorer: ExplorerConfig) {
  const { address, ensName } = await resolveAddress(client, addressInput, "contract address");

  let code: string | undefined;
  try {
    code = await client.getCode({ address });
  } catch (error) {
    throw toBlockchainError(error);
  }
  if (!code || code === "0x") {
    throw new BlockchainError(
      "NOT_FOUND",
      `${ensName ?? address} has no contract code on ${NETWORK_NAME}: it is a regular wallet (EOA) or nothing is deployed there.`,
    );
  }

  const notes: string[] = [];
  const [source, slotValue] = await Promise.all([
    fetchContractSource(address, explorer).catch(() => {
      notes.push(`${explorerName(explorer)} was unavailable, so only onchain checks were possible.`);
      return null;
    }),
    client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT }).catch(() => undefined),
  ]);

  const slotImplementation = slotToAddress(slotValue);
  const implementation = source?.implementation ?? slotImplementation;
  const implementationSource: ContractSource | null =
    implementation && implementation.toLowerCase() !== address.toLowerCase()
      ? await fetchContractSource(implementation, explorer).catch(() => null)
      : null;

  // For a proxy, the implementation's ABI describes what users can actually call.
  const abi = implementationSource?.abi ?? source?.abi ?? null;
  if (source && !source.verified) notes.push("The source code is not verified on the explorer, so functions could not be listed.");
  if (implementation && !implementationSource?.verified) notes.push("This is a proxy and its implementation's source is not verified.");

  const probes = await probeContract(client, address);
  const functions = abi ? listFunctions(abi) : { read: [], write: [] };
  const writeNames = new Set(functions.write.map((f) => f.name));
  const allNames = new Set([...functions.read.map((f) => f.name), ...writeNames]);

  const standards = new Set<ContractStandard>();
  if (probes.token || ["totalSupply", "balanceOf", "transfer", "allowance"].every((n) => allNames.has(n))) standards.add("ERC-20");
  if (probes.erc721 || (allNames.has("ownerOf") && allNames.has("safeTransferFrom"))) standards.add("ERC-721");
  if (probes.erc1155 || allNames.has("balanceOfBatch")) standards.add("ERC-1155");
  if (probes.owner !== null || writeNames.has("transferOwnership")) standards.add("Ownable");
  if (allNames.has("hasRole") && writeNames.has("grantRole")) standards.add("AccessControl");
  if (probes.paused !== null || writeNames.has("pause")) standards.add("Pausable");
  if (implementation || [...writeNames].some((n) => /^upgradeTo/.test(n))) standards.add("Upgradeable proxy");
  // An NFT also answers balanceOf; don't call it a fungible token unless it has decimals.
  if (standards.has("ERC-721") && !probes.token) standards.delete("ERC-20");

  const privilegedFunctions = functions.write.flatMap((f) => {
    const match = PRIVILEGED.find((p) => p.pattern.test(f.name));
    return match ? [{ name: f.name, signature: f.signature, risk: match.risk }] : [];
  });

  return {
    address,
    ensName,
    network: NETWORK_NAME,
    name: safeName(implementationSource?.name ?? null) ?? safeName(source?.name ?? null),
    verified: Boolean(source?.verified || implementationSource?.verified),
    compilerVersion: (implementationSource ?? source)?.compilerVersion ?? null,
    license: (implementationSource ?? source)?.license ?? null,
    bytecodeBytes: (code.length - 2) / 2,
    proxy: implementation ? { implementation, implementationVerified: Boolean(implementationSource?.verified) } : null,
    standards: [...standards],
    token: probes.token,
    owner: probes.owner,
    ownerRenounced: probes.owner !== null && /^0x0{40}$/i.test(probes.owner),
    paused: probes.paused,
    readFunctions: functions.read.slice(0, MAX_FUNCTIONS).map((f) => f.signature),
    writeFunctions: functions.write.slice(0, MAX_FUNCTIONS).map((f) => f.signature),
    totalReadFunctions: functions.read.length,
    totalWriteFunctions: functions.write.length,
    events: abi ? listEvents(abi) : [],
    privilegedFunctions,
    notes,
    source: explorerName(explorer),
    explorerUrl: explorerAddressUrl(address),
  };
}

function slotToAddress(value: string | undefined): Address | null {
  if (!value || !/^0x[0-9a-f]{64}$/i.test(value)) return null;
  const hex = `0x${value.slice(-40)}`;
  return /^0x0{40}$/i.test(hex) ? null : getAddress(hex);
}

type FunctionInfo = { name: string; signature: string };

function listFunctions(abi: Abi) {
  const read: FunctionInfo[] = [];
  const write: FunctionInfo[] = [];
  for (const item of abi) {
    if (item.type !== "function" || !IDENTIFIER.test(item.name)) continue;
    const info = { name: item.name, signature: signature(item) };
    (item.stateMutability === "view" || item.stateMutability === "pure" ? read : write).push(info);
  }
  return { read, write };
}

function listEvents(abi: Abi) {
  return abi
    .filter((item) => item.type === "event" && IDENTIFIER.test(item.name))
    .map((item) => (item as { name: string }).name)
    .slice(0, MAX_FUNCTIONS);
}

function signature(fn: AbiFunction) {
  const types = fn.inputs.map((i) => (/^[a-z0-9[\]()]+$/i.test(i.type) ? i.type : "?"));
  return `${fn.name}(${types.join(",")})`;
}

function safeName(name: string | null) {
  return name && IDENTIFIER.test(name) ? name : null;
}

/** Cheap onchain probes that work whether or not the source is verified. */
async function probeContract(client: ChainClient, address: Address) {
  const read = <T>(p: Promise<T>) => p.then((v) => v as T | null).catch(() => null);
  const [owner, paused, erc721, erc1155, decimals, symbol, name, totalSupply] = await Promise.all([
    read(client.readContract({ address, abi: probeAbi, functionName: "owner" })),
    read(client.readContract({ address, abi: probeAbi, functionName: "paused" })),
    read(client.readContract({ address, abi: probeAbi, functionName: "supportsInterface", args: [ERC721_INTERFACE] })),
    read(client.readContract({ address, abi: probeAbi, functionName: "supportsInterface", args: [ERC1155_INTERFACE] })),
    read(client.readContract({ address, abi: erc20Abi, functionName: "decimals" })),
    read(client.readContract({ address, abi: erc20Abi, functionName: "symbol" })),
    read(client.readContract({ address, abi: erc20Abi, functionName: "name" })),
    read(client.readContract({ address, abi: erc20Abi, functionName: "totalSupply" })),
  ]);
  const isToken = typeof decimals === "number" && typeof totalSupply === "bigint";
  return {
    owner: typeof owner === "string" ? getAddress(owner) : null,
    paused: typeof paused === "boolean" ? paused : null,
    erc721: erc721 === true,
    erc1155: erc1155 === true,
    token: isToken
      ? {
          symbol: typeof symbol === "string" ? symbol.slice(0, 32) : "UNKNOWN",
          name: typeof name === "string" ? name.slice(0, 64) : "Unknown token",
          decimals: decimals as number,
          totalSupply: formatToken(totalSupply as bigint, decimals as number, 2),
        }
      : null,
  };
}
