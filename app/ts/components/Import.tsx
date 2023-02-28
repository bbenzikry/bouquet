import { batch, Signal } from '@preact/signals'
import { providers, utils } from 'ethers'
import { useState } from 'preact/hooks'
import { updateLatestBlock } from '../library/provider.js'
import { GetSimulationStackReply, serialize, EthereumAddress } from '../library/interceptor-types.js'
import { Button } from './Button.js'
import { AppSettings, BundleState, Signers } from '../library/types.js'
import { MEV_RELAY_GOERLI, MEV_RELAY_MAINNET } from '../constants.js'

export async function importFromInterceptor(
	interceptorPayload: Signal<BundleState | undefined>,
	provider: Signal<providers.Web3Provider | undefined>,
	blockInfo: Signal<{
		blockNumber: bigint
		baseFee: bigint
		priorityFee: bigint
	}>,
	appSettings: Signal<AppSettings>,
	signers: Signal<Signers> | undefined,
) {
	if (!window.ethereum || !window.ethereum.request) throw Error('Import Error: No Ethereum wallet detected')

	await window.ethereum.request({ method: 'eth_requestAccounts' }).catch((err: { code: number }) => {
		if (err.code === 4001) {
			throw new Error('Import Error: Wallet connection rejected')
		} else {
			throw new Error(`Unknown Error: ${JSON.stringify(err)}`)
		}
	})

	// We only support goerli right now
	const ethereumProvider = new providers.Web3Provider(window.ethereum, 'any')
	const { chainId } = await ethereumProvider.getNetwork()
	if (![1, 5].includes(chainId)) {
		await ethereumProvider.send('wallet_switchEthereumChain', [{ chainId: appSettings.peek().relayEndpoint === MEV_RELAY_MAINNET ? '0x1' : '0x5' }])
	} else {
		appSettings.value = { ...appSettings.peek(), relayEndpoint: chainId === 1 ? MEV_RELAY_MAINNET : MEV_RELAY_GOERLI }
	}

	const blockCallback = (blockNumber: number) => {
		updateLatestBlock(blockNumber, provider, blockInfo, signers)
	}

	const { payload } = await window.ethereum
		.request({
			method: 'interceptor_getSimulationStack',
			params: ['1.0.0'],
		})
		.catch((err: { code: number }) => {
			if (err?.code === -32601) {
				throw new Error('Import Error: Wallet does not support returning simulations')
			} else {
				throw new Error(`Unknown Error: ${JSON.stringify(err)}`)
			}
		})

	const parsed = GetSimulationStackReply.parse(payload)
	if (parsed.length === 0) throw new Error('Import Error: You have no transactions on your simulation')

	localStorage.setItem('payload', JSON.stringify(GetSimulationStackReply.serialize(parsed)))

	const containsFundingTx = parsed.length > 1 && parsed[0].to === parsed[1].from
	const uniqueSigners = [...new Set(parsed.map((x) => utils.getAddress(serialize(EthereumAddress, x.from))))].filter(
		(_, index) => !(index === 0 && containsFundingTx),
	)

	const totalGas = parsed.reduce((sum, tx, index) => (index === 0 && containsFundingTx ? 21000n : BigInt(tx.gasLimit.toString()) + sum), 0n)
	// @TODO: Change this to track minimum amount of ETH needed to deposit
	const inputValue = parsed.reduce((sum, tx, index) => (index === 0 && containsFundingTx ? 0n : BigInt(tx.value.toString()) + sum), 0n)

	batch(() => {
		provider.value = ethereumProvider
		provider.value.on('block', blockCallback)

		interceptorPayload.value = { payload: parsed, containsFundingTx, uniqueSigners, totalGas, inputValue }
	})
}

export const Import = ({
	interceptorPayload,
	provider,
	blockInfo,
	signers,
	appSettings,
}: {
	interceptorPayload: Signal<BundleState | undefined>
	provider: Signal<providers.Web3Provider | undefined>
	blockInfo: Signal<{
		blockNumber: bigint
		baseFee: bigint
		priorityFee: bigint
	}>
	signers: Signal<Signers>
	appSettings: Signal<AppSettings>
}) => {
	const [error, setError] = useState<string | undefined>(undefined)

	const clearPayload = () => {
		batch(() => {
			interceptorPayload.value = undefined
			localStorage.removeItem('payload')
			signers.value.bundleSigners = {}
			// Keep burner wallet as long as it has funds, should clear is later if there is left over dust but not needed.
			// if (fundingAccountBalance.value === 0n) signers.value.burner = undefined
		})
	}

	return (
		<>
			<h2 className='font-bold text-2xl'>1. Import</h2>
			<div className='flex flex-col w-full gap-6'>
				<div className='flex flex-col sm:flex-row gap-4'>
					<Button
						onClick={() => importFromInterceptor(interceptorPayload, provider, blockInfo, appSettings, signers).catch((err: Error) => setError(err.message))}
					>
						Import Payload from The Interceptor
					</Button>
					{interceptorPayload.value ? (
						<Button variant='secondary' onClick={clearPayload}>
							Reset
						</Button>
					) : null}
				</div>
				{error ? <span className='text-lg text-error'>{error}</span> : ''}
				{error && error === 'Import Error: Wallet does not support returning simulations' ? (
					<h3 className='text-lg'>
						Don't have The Interceptor Installed? Install it here{' '}
						<a className='font-bold text-accent underline' href='https://dark.florist'>
							here
						</a>
						.
					</h3>
				) : (
					''
				)}
			</div>
		</>
	)
}
