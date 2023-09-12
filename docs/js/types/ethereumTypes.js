import * as t from 'funtypes';
const BigIntParser = {
    parse: (value) => {
        if (!/^0x([a-fA-F0-9]{1,64})$/.test(value))
            return {
                success: false,
                message: `${value} is not a hex string encoded number.`,
            };
        else
            return { success: true, value: BigInt(value) };
    },
    serialize: (value) => {
        if (typeof value !== 'bigint')
            return { success: false, message: `${typeof value} is not a bigint.` };
        return { success: true, value: `0x${value.toString(16)}` };
    },
};
export const AddressParser = {
    parse: (value) => {
        if (!/^0x([a-fA-F0-9]{40})$/.test(value))
            return {
                success: false,
                message: `${value} is not a hex string encoded address.`,
            };
        else
            return { success: true, value: BigInt(value) };
    },
    serialize: (value) => {
        if (typeof value !== 'bigint')
            return { success: false, message: `${typeof value} is not a bigint.` };
        return { success: true, value: `0x${value.toString(16).padStart(40, '0')}` };
    },
};
const Bytes32Parser = {
    parse: (value) => {
        if (!/^0x([a-fA-F0-9]{64})$/.test(value))
            return {
                success: false,
                message: `${value} is not a hex string encoded 32 byte value.`,
            };
        else
            return { success: true, value: BigInt(value) };
    },
    serialize: (value) => {
        if (typeof value !== 'bigint')
            return { success: false, message: `${typeof value} is not a bigint.` };
        return { success: true, value: `0x${value.toString(16).padStart(64, '0')}` };
    },
};
export const BytesParser = {
    parse: (value) => {
        const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(value);
        if (match === null)
            return {
                success: false,
                message: `Expected a hex string encoded byte array with an optional '0x' prefix but received ${value}`,
            };
        const normalized = match[1];
        if (normalized.length % 2)
            return {
                success: false,
                message: `Hex string encoded byte array must be an even number of charcaters long.`,
            };
        const bytes = new Uint8Array(normalized.length / 2);
        for (let i = 0; i < normalized.length; i += 2) {
            bytes[i / 2] = Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16);
        }
        return { success: true, value: new Uint8Array(bytes) };
    },
    serialize: (value) => {
        if (!(value instanceof Uint8Array))
            return { success: false, message: `${typeof value} is not a Uint8Array.` };
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += ('0' + value[i].toString(16)).slice(-2);
        }
        return { success: true, value: `0x${result}` };
    },
};
const OptionalBytesParser = {
    parse: (value) => BytesParser.parse(value || '0x'),
    serialize: (value) => BytesParser.serialize(value || new Uint8Array()),
};
export const LiteralConverterParserFactory = (input, output) => {
    return {
        parse: (value) => (value === input ? { success: true, value: output } : { success: false, message: `${value} was expected to be literal.` }),
        serialize: (value) => (value === output ? { success: true, value: input } : { success: false, message: `${value} was expected to be literal.` }),
    };
};
export const EthereumQuantity = t.String.withParser(BigIntParser);
export const EthereumData = t.String.withParser(BytesParser);
export const EthereumAddress = t.String.withParser(AddressParser);
export const EthereumBytes32 = t.String.withParser(Bytes32Parser);
export const EthereumInput = t.Union(t.String, t.Undefined).withParser(OptionalBytesParser);
//# sourceMappingURL=ethereumTypes.js.map