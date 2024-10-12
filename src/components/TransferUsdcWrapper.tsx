'use client';
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import type {
  TransactionError,
  TransactionResponse,
} from '@coinbase/onchainkit/transaction';
import type { Address, ContractFunctionParameters } from 'viem';
import { erc20Abi, parseUnits } from 'viem';
import {
  BASE_SEPOLIA_CHAIN_ID,
} from '../constants';

const USDC_ADDRESS = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'; // USDC contract address on Base Sepolia

interface TransferUsdcWrapperProps {
  recipientAddress: Address;
  amount: string;
}

export default function TransferUsdcWrapper({ recipientAddress, amount }: TransferUsdcWrapperProps) {
  const contracts = [
    {
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipientAddress, parseUnits(amount, 6)],
    },
  ] as unknown as ContractFunctionParameters[];

  const handleError = (err: TransactionError) => {
    console.error('USDC transfer error:', err);
  };

  const handleSuccess = (response: TransactionResponse) => {
    console.log('USDC transfer successful', response);
  };

  return (
    <div className="flex w-[450px]">
      <Transaction
        contracts={contracts}
        className="w-[450px]"
        chainId={BASE_SEPOLIA_CHAIN_ID}
        onError={handleError}
        onSuccess={handleSuccess}
      >
        <TransactionButton className="mt-0 mr-auto ml-auto w-[450px] max-w-full text-[white]" text='Send USDC' />
        <TransactionStatus>
          <TransactionStatusLabel />
          <TransactionStatusAction />
        </TransactionStatus>
      </Transaction>
    </div>
  );
}
