import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { batch, useSignal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { parseEther } from 'ethers';
import { connectBrowserProvider } from '../library/provider.js';
import { GetSimulationStackReply } from '../types/interceptorTypes.js';
import { Button } from './Button.js';
import { serialize } from '../types/types.js';
import { TransactionList } from '../types/bouquetTypes.js';
import { ImportModal } from './ImportModal.js';
import { SingleNotice } from './Warns.js';
import { addressString } from '../library/utils.js';
export async function importFromInterceptor(bundle, provider, blockInfo, appSettings, signers) {
    if (!window.ethereum || !window.ethereum.request)
        throw Error('No Ethereum wallet detected');
    connectBrowserProvider(provider, blockInfo, signers, appSettings);
    const { payload } = await window.ethereum
        .request({
        method: 'interceptor_getSimulationStack',
        params: ['1.0.0'],
    })
        .catch((err) => {
        if (err?.code === -32601) {
            throw new Error('Wallet does not support returning simulations');
        }
        else {
            throw new Error(`Unknown Error: ${JSON.stringify(err)}`);
        }
    });
    const tryParse = GetSimulationStackReply.safeParse(payload);
    if (!tryParse.success)
        throw new Error('Wallet does not support returning simulations');
    if (tryParse.value.length === 0)
        throw new Error('You have no transactions on your simulation');
    const converted = TransactionList.safeParse(serialize(GetSimulationStackReply, tryParse.value).map(({ from, to, value, input, gasLimit, chainId }) => ({ from, to, value, input, gasLimit, chainId })));
    if (!converted.success)
        throw new Error('Malformed simulation stack');
    if (converted.value.length >= 2 && converted.value[0].to === converted.value[1].from && converted.value[0].value === parseEther('200000')) {
        const fundingAddrr = converted.value[0].from;
        converted.value = converted.value.map(tx => tx.from === fundingAddrr ? { ...tx, from: 'FUNDING' } : tx);
    }
    const uniqueToAddresses = [...new Set(converted.value.map(({ from }) => from))];
    const containsFundingTx = uniqueToAddresses.includes('FUNDING');
    const uniqueSigners = uniqueToAddresses.filter((address) => address !== 'FUNDING').map(address => addressString(address));
    const totalGas = converted.value.reduce((sum, tx) => tx.gasLimit + sum, 0n);
    // Take addresses that recieved funding, determine spend deficit - gas fees
    const fundingRecipients = new Set(converted.value.reduce((result, tx) => (tx.to && tx.from === 'FUNDING' ? [...result, tx.to] : result), []));
    const spenderDeficits = tryParse.value.reduce((amounts, tx) => {
        if (!fundingRecipients.has(tx.from))
            return amounts;
        const txDiff = tx.balanceChanges.filter(x => x.address === tx.from).reduce((sum, bal) => sum + bal.before - bal.after, 0n) + tx.maxPriorityFeePerGas * tx.gasSpent;
        const amount = amounts[tx.from.toString()] ? amounts[tx.from.toString()] + txDiff : txDiff;
        amounts[tx.from.toString()] = amount;
        return amounts;
    }, {});
    const inputValue = Object.values(spenderDeficits).reduce((sum, amount) => amount + sum, 0n);
    // Copy value and set, input of funding to inputValue
    const transactions = [...converted.value];
    if (containsFundingTx) {
        transactions[0] = { ...transactions[0], value: inputValue };
    }
    localStorage.setItem('payload', JSON.stringify(TransactionList.serialize(transactions)));
    bundle.value = { transactions, containsFundingTx, uniqueSigners, totalGas, inputValue };
}
export const Import = ({ bundle, provider, blockInfo, signers, appSettings, }) => {
    const showImportModal = useSignal(false);
    const [error, setError] = useState(undefined);
    const clearPayload = () => {
        batch(() => {
            bundle.value = undefined;
            localStorage.removeItem('payload');
            signers.value.bundleSigners = {};
            setError('');
            // Keep burner wallet as long as it has funds, should clear is later if there is left over dust but not needed.
            // if (fundingAccountBalance.value === 0n) signers.value.burner = undefined
        });
    };
    return (_jsxs(_Fragment, { children: [showImportModal.value ? _jsx(ImportModal, { bundle: bundle, clearError: () => setError(''), display: showImportModal }) : null, _jsxs("h2", { className: 'font-bold text-2xl', children: [_jsx("span", { class: 'text-gray-500', children: "1." }), " Import"] }), _jsxs("div", { className: 'flex flex-col w-full gap-6', children: [_jsxs("div", { className: 'flex flex-col sm:flex-row gap-4', children: [_jsx(Button, { onClick: () => importFromInterceptor(bundle, provider, blockInfo, appSettings, signers).then(() => setError(undefined)).catch((err) => setError(err.message)), children: "Import Payload from The Interceptor" }), _jsx(Button, { onClick: () => showImportModal.value = true, children: "Import From JSON" }), bundle.value ? (_jsx(Button, { variant: 'secondary', onClick: clearPayload, children: "Reset" })) : null] }), error ? _jsx(SingleNotice, { variant: 'error', title: 'Could Not Import Transactions', description: error }) : null, error && error === 'Wallet does not support returning simulations' ? (_jsxs("h3", { className: 'text-xl', children: ["Don't have The Interceptor Installed? Install it here", ' ', _jsx("a", { className: 'font-bold text-accent underline', href: 'https://dark.florist', children: "here" }), "."] })) : ('')] })] }));
};
//# sourceMappingURL=Import.js.map