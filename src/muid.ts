export type UInt64 = {
  high: number;
  low: number;
};

export type MuidConfig = {
  machineID?: UInt64;
  timestampBitLen?: number;
  machineIDBitLen?: number;
  epoch?: UInt64;
};

const defaultEpochValue = 1700000000000;

export const make64 = (high: number, low: number): UInt64 => ({
  high: high >>> 0,
  low: low >>> 0,
});

export const from32 = (value: number) => make64(0, value >>> 0);

export const add64 = (a: UInt64, b: UInt64) => {
  const low = (a.low + b.low) >>> 0;
  const carry = a.low + b.low > 0xffffffff ? 1 : 0;
  const high = (a.high + b.high + carry) >>> 0;
  return make64(high, low);
};

export const sub64 = (a: UInt64, b: UInt64) => {
  const low = (a.low - b.low) >>> 0;
  const borrow = a.low < b.low ? 1 : 0;
  const high = (a.high - b.high - borrow) >>> 0;
  return make64(high, low);
};

export const shl64 = (value: UInt64, bits: number) => {
  if (bits === 0) {
    return value;
  }
  if (bits >= 64) {
    return make64(0, 0);
  }
  if (bits >= 32) {
    return make64(value.low << (bits - 32), 0);
  }

  const high = (value.high << bits) | (value.low >>> (32 - bits));
  const low = value.low << bits;
  return make64(high >>> 0, low >>> 0);
};

export const shr64 = (value: UInt64, bits: number) => {
  if (bits === 0) {
    return value;
  }
  if (bits >= 64) {
    return make64(0, 0);
  }
  if (bits >= 32) {
    return make64(0, value.high >>> (bits - 32));
  }

  const low = (value.low >>> bits) | (value.high << (32 - bits));
  const high = value.high >>> bits;
  return make64(high >>> 0, low >>> 0);
};

export const or64 = (a: UInt64, b: UInt64) =>
  make64((a.high | b.high) >>> 0, (a.low | b.low) >>> 0);

export const and64 = (a: UInt64, b: UInt64) =>
  make64((a.high & b.high) >>> 0, (a.low & b.low) >>> 0);

export const cmp64 = (a: UInt64, b: UInt64) => {
  if (a.high < b.high) {
    return -1;
  }
  if (a.high > b.high) {
    return 1;
  }
  if (a.low < b.low) {
    return -1;
  }
  if (a.low > b.low) {
    return 1;
  }
  return 0;
};

const gte64 = (a: UInt64, b: UInt64) => cmp64(a, b) >= 0;

const toHex64 = (value: UInt64) => {
  if (value.high === 0) {
    return value.low.toString(16);
  }

  const highHex = value.high.toString(16);
  let lowHex = value.low.toString(16);
  while (lowHex.length < 8) {
    lowHex = `0${lowHex}`;
  }
  return `${highHex}${lowHex}`;
};

const toString64 = (value: UInt64) => {
  if (value.high === 0) {
    return value.low.toString();
  }

  if (value.high < 0x200000) {
    return (value.high * 0x100000000 + value.low).toString();
  }

  return `0x${toHex64(value)}`;
};

const toBase32_64 = (value: UInt64) => {
  if (value.high === 0) {
    return value.low.toString(32);
  }

  const hex = toHex64(value);
  let num = 0;
  let result = "";

  for (let index = 0; index < hex.length; index += 1) {
    num = num * 16 + Number.parseInt(hex[index]!, 16);
    if (num >= 32) {
      result += (num % 32).toString(32);
      num = Math.floor(num / 32);
    }
  }

  if (num > 0) {
    result = `${num.toString(32)}${result}`;
  }

  return result || "0";
};

const hashString = (value: string) => {
  let hash = make64(0x811c9dc5, 0);
  const prime = from32(0x01000193);

  for (let index = 0; index < value.length; index += 1) {
    const char = from32(value.charCodeAt(index));
    hash = and64(or64(hash, char), make64(0, 0xffffffff));
    if (hash.high === 0) {
      hash = from32((hash.low * prime.low) >>> 0);
    }
  }

  return hash;
};

const getMachineIdentifier = () => {
  if (typeof process !== "undefined") {
    const identifier =
      process.env.HOSTNAME ??
      process.env.COMPUTERNAME ??
      process.release?.name;
    if (identifier) {
      return identifier;
    }
  }

  if (typeof navigator !== "undefined") {
    return `${navigator.userAgent}${navigator.platform}${navigator.hardwareConcurrency ?? ""}`;
  }

  return `js-${Math.random().toString(36).slice(2)}`;
};

const getRandomBytes = (length: number) => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint8Array(length);
    cryptoApi.getRandomValues(values);
    return Array.from(values);
  }

  return Array.from({ length }, () => Math.floor(Math.random() * 256));
};

export const getDefaultConfig = (): Required<MuidConfig> => {
  const epoch = make64(
    Math.floor(defaultEpochValue / 0x100000000),
    defaultEpochValue % 0x100000000,
  );
  const timestampBitLen = 41;
  const machineIDBitLen = 14;
  const maxMachineID = (1 << machineIDBitLen) - 1;
  const identifier = getMachineIdentifier();
  let machineID: UInt64;

  if (identifier) {
    const hash = hashString(identifier);
    machineID = from32(hash.low & maxMachineID);
  } else {
    const randomBytes = getRandomBytes(4);
    let randomValue = 0;
    for (let index = 0; index < 4; index += 1) {
      randomValue = (randomValue << 8) | randomBytes[index]!;
    }
    machineID = from32(randomValue & maxMachineID);
  }

  return {
    epoch,
    machineID,
    machineIDBitLen,
    timestampBitLen,
  };
};

export class MUID {
  readonly value: UInt64;

  constructor(value?: UInt64 | number | null) {
    if (typeof value === "number") {
      this.value = from32(value);
      return;
    }

    if (value && typeof value.high === "number" && typeof value.low === "number") {
      this.value = make64(value.high, value.low);
      return;
    }

    this.value = make64(0, 0);
  }

  toString() {
    return toBase32_64(this.value);
  }

  toHex() {
    return toHex64(this.value);
  }

  toDecimal() {
    return toString64(this.value);
  }

  valueOf() {
    return this.value;
  }
}

export class Generator {
  readonly timestampBitLen: number;
  readonly machineIDBitLen: number;
  readonly epoch: UInt64;
  readonly shardIndex: number;
  readonly shardBitLen: number;
  readonly counterBitLen: number;
  readonly timestampBitShift: number;
  readonly machineIDShift: number;
  readonly shardIndexShift: number;
  readonly counterBitMask: UInt64;
  readonly machineID: UInt64;
  state: UInt64;

  constructor(config: MuidConfig = {}, shardIndex = 0, shardBitLen = 0) {
    this.timestampBitLen = config.timestampBitLen ?? 41;
    this.machineIDBitLen = config.machineIDBitLen ?? 14;
    this.epoch =
      config.epoch ??
      make64(
        Math.floor(defaultEpochValue / 0x100000000),
        defaultEpochValue % 0x100000000,
      );
    this.shardIndex = shardIndex;
    this.shardBitLen = shardBitLen;
    this.counterBitLen =
      64 - this.timestampBitLen - this.machineIDBitLen - this.shardBitLen;
    this.timestampBitShift =
      this.machineIDBitLen + this.shardBitLen + this.counterBitLen;
    this.machineIDShift = this.shardBitLen + this.counterBitLen;
    this.shardIndexShift = this.counterBitLen;
    this.counterBitMask =
      this.counterBitLen >= 32
        ? make64(0xffffffff, 0xffffffff)
        : sub64(shl64(from32(1), this.counterBitLen), from32(1));

    const machineIDMask =
      this.machineIDBitLen >= 32
        ? make64(0xffffffff, 0xffffffff)
        : sub64(shl64(from32(1), this.machineIDBitLen), from32(1));

    this.machineID = and64(config.machineID ?? from32(0), machineIDMask);
    this.shardIndex =
      (this.shardIndex & ((1 << Math.min(this.shardBitLen, 31)) - 1)) >>> 0;
    this.state = from32(1);
  }

  id() {
    let now = sub64(from32(Date.now() & 0xffffffff), this.epoch);
    const dateNow = Date.now();
    if (dateNow > 0xffffffff) {
      now = sub64(
        make64(Math.floor(dateNow / 0x100000000), dateNow & 0xffffffff),
        this.epoch,
      );
    }
    const lastTimestamp = shr64(this.state, this.counterBitLen);
    let counter = and64(this.state, this.counterBitMask);

    if (cmp64(now, lastTimestamp) < 0) {
      now = lastTimestamp;
    }

    if (cmp64(now, lastTimestamp) === 0) {
      if (gte64(counter, this.counterBitMask)) {
        now = add64(now, from32(1));
        counter = from32(1);
      } else {
        counter = add64(counter, from32(1));
      }
    } else {
      counter = from32(1);
    }

    this.state = or64(shl64(now, this.counterBitLen), counter);

    const timestampPart = shl64(now, this.timestampBitShift);
    const machineIDPart = shl64(this.machineID, this.machineIDShift);
    const shardIndexPart = shl64(from32(this.shardIndex), this.shardIndexShift);
    return new MUID(
      or64(or64(or64(timestampPart, machineIDPart), shardIndexPart), counter),
    );
  }
}

export class ShardedGenerators {
  readonly pool: Generator[];
  readonly size: number;
  index = 0;

  constructor() {
    const numCPU =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    const shardBits =
      numCPU > 1 ? Math.min(Math.ceil(Math.log2(numCPU)), 5) : 0;
    const defaultConfig = getDefaultConfig();
    this.size = 1 << shardBits;
    this.pool = [];

    for (let index = 0; index < this.size; index += 1) {
      this.pool.push(new Generator(defaultConfig, index, shardBits));
    }
  }

  next() {
    const generator = this.pool[this.index]!;
    this.index = (this.index + 1) % this.size;
    return generator;
  }
}

const defaultGenerator = new Generator(getDefaultConfig(), 0, 0);

export const make = () => defaultGenerator.id();

export const newGenerator = (
  config: MuidConfig = {},
  shardIndex = 0,
  shardBitLen = 0,
) =>
  new Generator(
    {
      ...getDefaultConfig(),
      ...config,
    },
    shardIndex,
    shardBitLen,
  );

export const makeMuid = (prefix: string) => `${prefix}-${make().toString()}`;
