'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import type { NextApiRequest, NextApiResponse } from 'next';
import nacl from 'tweetnacl';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import { Input } from './ui/input';
import { motion } from 'framer-motion';
import bs58 from 'bs58';
import { ethers } from 'ethers';
import {
    ChevronDown,
    ChevronUp,
    Copy,
    Eye,
    EyeOff,
    Grid2X2,
    List,
    Trash,
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from './ui/alert-dialog';
import axios, { Axios } from 'axios';

interface Wallet {
    publicKey: string;
    privateKey: string;
    mnemonic: string;
    path: string;
}

const WalletGenerator = () => {
    // memonicString, PathType, showMemonic, visiblePrivateKey, visiblePublicKey, gridView
    const [mnemonicWords, setMnemonicWords] = useState<string[]>(
        Array(12).fill(' ')
    );
    const [pathTypes, setPathTypes] = useState<string[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [showMnemonic, setShowMnemonic] = useState<boolean>(false);
    const [mnemonicInput, setMnemonicInput] = useState<string>('');
    const [visiblePrivateKeys, setVisiblePrivateKeys] = useState<boolean[]>([]);
    const [visiblePhrases, setVisiblePhrases] = useState<boolean[]>([]);
    const [gridView, setGridView] = useState<boolean>(false);
    const pathTypeNames: { [key: string]: string } = {
        '501': 'Solana',
        '60': 'Ethereum',
    };
    const [firstPage, setFirstPage] = useState<boolean>(true);
    const [balance, setBalance] = useState<number>(0);

    const pathTypeName = pathTypeNames[pathTypes[0]] || '';
    // Whenever the page is re-rendered this useeffect hook is called again
    useEffect(() => {
        const storedWallets = localStorage.getItem('wallets');
        const storedMnemonic = localStorage.getItem('mnemonics');
        const storedPathTypes = localStorage.getItem('paths');
        if (storedWallets && storedMnemonic && storedPathTypes) {
            setWallets(JSON.parse(storedWallets));
            setMnemonicWords(JSON.parse(storedMnemonic));
            setPathTypes(JSON.parse(storedPathTypes));
            setVisiblePrivateKeys(JSON.parse(storedWallets).map(() => false));
            setVisiblePhrases(JSON.parse(storedWallets).map(() => false));
        }
    }, []);

    useEffect(() => {
        if (firstPage) {
            setWallets([]);
        }
    }, [firstPage]);

    const handleDeleteWallet = (index: number) => {
        setWallets(wallets.filter((_, i) => i !== index));
        setPathTypes(pathTypes.filter((_, i) => i !== index));
        localStorage.setItem(
            'wallets',
            JSON.stringify(wallets.filter((_, i) => i !== index))
        );
        localStorage.setItem(
            'paths',
            JSON.stringify(pathTypes.filter((_, i) => i !== index))
        );
        setVisiblePrivateKeys(visiblePrivateKeys.filter((_, i) => i !== index));
        setVisiblePhrases(visiblePhrases.filter((_, i) => i !== index));
        toast.success('Wallet deleted successfully!');
    };

    const handleClearWallets = () => {
        localStorage.removeItem('wallets');
        localStorage.removeItem('mnemonics');
        localStorage.removeItem('paths');
        setWallets([]);
        setMnemonicWords([]);
        setPathTypes([]);
        setVisiblePrivateKeys([]);
        setVisiblePhrases([]);
        toast.success('All wallets cleared.');
    };

    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
    };

    const togglePrivateKeyVisibility = (index: number) => {
        setVisiblePrivateKeys(
            visiblePrivateKeys.map((visible, i) =>
                i === index ? !visible : visible
            )
        );
    };

    const togglePhraseVisibility = (index: number) => {
        setVisiblePhrases(
            visiblePhrases.map((visible, i) =>
                i === index ? !visible : visible
            )
        );
    };

    const generateWalletFromMnemonic = (
        pathType: string,
        mnemonic: string,
        accountIndex: number
    ): Wallet | null => {
        try {
            const seedBuffer = mnemonicToSeedSync(mnemonic);
            const path = `m/44'/${pathType}'/0'/${accountIndex}'`;
            const { key: derivedSeed } = derivePath(
                path,
                seedBuffer.toString('hex')
            );
            let publicKeyEncoded: string;
            let privateKeyEncoded: string;
            if (pathType === '501') {
                // Solana
                const { secretKey } = nacl.sign.keyPair.fromSeed(derivedSeed);
                const keypair = Keypair.fromSecretKey(secretKey);
                privateKeyEncoded = bs58.encode(secretKey);
                publicKeyEncoded = keypair.publicKey.toBase58();
            } else if (pathType === '60') {
                // Ethereum
                const privateKey = Buffer.from(derivedSeed).toString('hex');
                privateKeyEncoded = privateKey;
                const wallet = new ethers.Wallet(privateKey);
                publicKeyEncoded = wallet.address;
            } else {
                toast.error('Unsupported path type.');
                return null;
            }
            return {
                publicKey: publicKeyEncoded,
                privateKey: privateKeyEncoded,
                mnemonic,
                path,
            };
        } catch (error) {
            toast.error('Failed to generate wallet. Please try again.');
            return null;
        }
    };

    const handleGenerateWallet = () => {
        let mnemonic = mnemonicInput.trim();

        if (mnemonic) {
            if (!validateMnemonic(mnemonic)) {
                toast.error('Invalid recovery phrase. Please try again.');
                return;
            }
        } else {
            mnemonic = generateMnemonic();
        }

        const words = mnemonic.split(' ');
        setMnemonicWords(words);

        const wallet = generateWalletFromMnemonic(
            pathTypes[0],
            mnemonic,
            wallets.length
        );
        if (wallet) {
            const updatedWallets = [...wallets, wallet];
            setWallets(updatedWallets);
            localStorage.setItem('wallets', JSON.stringify(updatedWallets));
            localStorage.setItem('mnemonics', JSON.stringify(words));
            localStorage.setItem('paths', JSON.stringify(pathTypes));
            setVisiblePrivateKeys([...visiblePrivateKeys, false]);
            setVisiblePhrases([...visiblePhrases, false]);
            toast.success('Wallet generated successfully!');
        }
    };

    const handleAddWallet = () => {
        if (!mnemonicWords) {
            toast.error('No mnemonic found. Please generate a wallet first.');
            return;
        }

        const wallet = generateWalletFromMnemonic(
            pathTypes[0],
            mnemonicWords.join(' '),
            wallets.length
        );

        if (wallet) {
            const updatedWallets = [...wallets, wallet];
            const updatedPathType = [pathTypes, pathTypes];
            setWallets(updatedWallets);
            localStorage.setItem('wallets', JSON.stringify(updatedWallets));
            localStorage.setItem('pathTypes', JSON.stringify(updatedPathType));
            setVisiblePrivateKeys([...visiblePrivateKeys, false]);
            setVisiblePhrases([...visiblePhrases, false]);
            toast.success('Wallet generated successfully!');
        }
    };

    const getBalanceDetails = async (publicKey: string) => {
        if (pathTypes[0] === '501') {
            // Solana
            console.log('Fetching Solana balance');
            const url =
                'https://solana-devnet.g.alchemy.com/v2/jt65VVGJQMFWJyh2az9CIZv9EWYZ1zek';
            const data = {
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [publicKey],
            };

            console.log('Public Key is : ', data.params[0]);

            try {
                const response = await axios.post(url, data, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                setBalance(response.data.result.value.toString());
                console.log(response.data);
            } catch (error) {
                console.error('Error fetching Solana balance:', error);
            }
        } else if (pathTypes[0] === '60') {
            // Ethereum
            console.log('Fetching Ethereum balance');
            try {
                const response = await fetch(
                    `https://api.etherscan.io/api?module=account&action=balance&address=${publicKey}&tag=latest&apikey=YourApiKeyToken`
                );
                const data = await response.json();
                setBalance(data.result);
                console.log(data);
            } catch (error) {
                console.error('Error fetching Ethereum balance:', error);
            }
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {firstPage && (
                <motion.div
                    className="flex flex-col gap-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.3,
                        ease: 'easeInOut',
                    }}>
                    <div className="flex flex-col gap-4">
                        {pathTypes.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.3,
                                    ease: 'easeInOut',
                                }}
                                className="flex gap-4 flex-col my-12">
                                <div className="flex flex-col gap-2">
                                    <h1 className="tracking-tighter text-4xl md:text-5xl font-black">
                                        Rokum supports multiple blockchains
                                    </h1>
                                    <p className="text-primary/80 font-semibold text-lg md:text-xl">
                                        Choose a blockchain to get started.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size={'lg'}
                                        onClick={() => {
                                            setPathTypes(['501']);
                                            toast.success(
                                                'Solana Wallet selected. Please generate a wallet to continue.'
                                            );
                                        }}>
                                        Solana
                                    </Button>
                                    <Button
                                        size={'lg'}
                                        onClick={() => {
                                            setPathTypes(['60']);
                                            toast.success(
                                                'Ethereum Wallet selected. Please generate a wallet to continue.'
                                            );
                                        }}>
                                        Ethereum
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                        {pathTypes.length !== 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.3,
                                    ease: 'easeInOut',
                                }}
                                className="flex flex-col gap-4 my-12">
                                <div className="flex flex-col gap-2">
                                    <h1 className="tracking-tighter text-4xl md:text-5xl font-black">
                                        Secret Recovery Phrase
                                    </h1>
                                    <p className="text-primary/80 font-semibold text-lg md:text-xl">
                                        Save these words in a safe place.
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <Input
                                        type="password"
                                        placeholder="Enter your secret phrase (or leave blank to generate)"
                                        onChange={(e) =>
                                            setMnemonicInput(e.target.value)
                                        }
                                        value={mnemonicInput}
                                    />
                                    <Button
                                        size={'lg'}
                                        onClick={() => {
                                            handleGenerateWallet();
                                            setFirstPage(false);
                                        }}>
                                        {mnemonicInput
                                            ? 'Add Wallet'
                                            : 'Generate Wallet'}
                                    </Button>
                                    <Button
                                        size={'lg'}
                                        onClick={() => {
                                            setPathTypes([]);
                                            toast.success("Let's start over.");
                                        }}>
                                        Go Back
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Display Secret Phrase */}
            {mnemonicWords && !firstPage && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.3,
                        ease: 'easeInOut',
                    }}
                    className="group flex flex-col items-center gap-4 cursor-pointer rounded-lg border border-primary/10 p-8">
                    <div
                        className="flex w-full justify-between items-center"
                        onClick={() => setShowMnemonic(!showMnemonic)}>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tighter">
                            Your Secret Phrase
                        </h2>
                        <Button
                            onClick={() => setShowMnemonic(!showMnemonic)}
                            variant="ghost">
                            {showMnemonic ? (
                                <ChevronUp className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </Button>
                    </div>

                    {showMnemonic && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: 'easeInOut',
                            }}
                            className="flex flex-col w-full items-center justify-center"
                            onClick={() =>
                                copyToClipboard(mnemonicWords.join(' '))
                            }>
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.3,
                                    ease: 'easeInOut',
                                }}
                                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 justify-center w-full items-center mx-auto my-8">
                                {mnemonicWords.map((word, index) => (
                                    <p
                                        key={index}
                                        className="md:text-lg bg-foreground/5 hover:bg-foreground/10 transition-all duration-300 rounded-lg p-4">
                                        {word}
                                    </p>
                                ))}
                            </motion.div>
                            <div className="text-sm md:text-base text-primary/50 flex w-full gap-2 items-center group-hover:text-primary/80 transition-all duration-300">
                                <Copy className="size-4" /> Click Anywhere To
                                Copy
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Display wallet pairs */}
            {!firstPage && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        delay: 0.3,
                        duration: 0.3,
                        ease: 'easeInOut',
                    }}
                    className="flex flex-col gap-8 mt-6">
                    <div className="flex md:flex-row flex-col justify-between w-full gap-4 md:items-center">
                        <h2 className="tracking-tighter text-3xl md:text-4xl font-extrabold">
                            {pathTypeName} Wallet
                        </h2>
                        <div className="flex gap-2">
                            {wallets.length > 1 && (
                                <Button
                                    variant={'ghost'}
                                    onClick={() => setGridView(!gridView)}
                                    className="hidden md:block">
                                    {gridView ? <Grid2X2 /> : <List />}
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    handleAddWallet();
                                }}>
                                Add Wallet
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        className="self-end">
                                        Clear Wallets
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Are you sure you want to delete all
                                            wallets?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This
                                            will permanently delete your wallets
                                            and keys from local storage.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => {
                                                handleClearWallets();
                                                setFirstPage(true);
                                            }}>
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <div
                        className={`grid gap-6 grid-cols-1 col-span-1  ${
                            gridView
                                ? 'md:grid-cols-2 lg:grid-cols-4 md:grid-rows-1'
                                : ''
                        }`}>
                        {wallets.map((wallet: any, index: number) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: 0.3 + index * 0.1,
                                    duration: 0.3,
                                    ease: 'easeInOut',
                                }}
                                className="flex flex-col rounded-2xl border border-primary/10">
                                <div className="flex justify-between px-8 py-6">
                                    <h3 className="font-bold text-2xl md:text-3xl tracking-tighter ">
                                        Wallet {index + 1}
                                    </h3>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="flex gap-2 items-center">
                                                <Trash className="size-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Are you sure you want to
                                                    delete all wallets?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be
                                                    undone. This will
                                                    permanently delete your
                                                    wallets and keys from local
                                                    storage.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() =>
                                                        handleDeleteWallet(
                                                            index
                                                        )
                                                    }
                                                    className="text-destructive">
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                <div className="flex flex-col gap-8 px-8 py-4 rounded-2xl bg-secondary/50">
                                    <div className="flex sm:justify-between md:flex-col md:gap-4 ">
                                        <div
                                            className="flex flex-col w-full gap-2"
                                            onClick={() =>
                                                copyToClipboard(
                                                    wallet.publicKey
                                                )
                                            }>
                                            <span className="text-lg md:text-xl font-bold tracking-tighter">
                                                Public Key
                                            </span>
                                            <p className="text-primary/80 font-medium cursor-pointer hover:text-primary transition-all duration-300 truncate">
                                                {wallet.publicKey}
                                            </p>
                                        </div>
                                        <div className="flex flex-col w-full gap-3">
                                            <span className="text-lg md:text-xl font-bold tracking-tighter">
                                                Balance
                                            </span>
                                            <div className="flex justify-between w-full items-center gap-2">
                                                <p className="text-primary/80 font-medium cursor-pointer hover:text-primary transition-all duration-300 truncate">
                                                    {balance} SOL
                                                </p>
                                                <Button
                                                    onClick={() =>
                                                        getBalanceDetails(
                                                            wallet.publicKey
                                                        )
                                                    }>
                                                    Refresh
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full gap-2">
                                        <span className="text-lg md:text-xl font-bold tracking-tighter">
                                            Private Key
                                        </span>
                                        <div className="flex justify-between w-full items-center gap-2">
                                            <p
                                                onClick={() =>
                                                    copyToClipboard(
                                                        wallet.privateKey
                                                    )
                                                }
                                                className="text-primary/80 font-medium cursor-pointer hover:text-primary transition-all duration-300 truncate">
                                                {visiblePrivateKeys[index]
                                                    ? wallet.privateKey
                                                    : '•'.repeat(
                                                          wallet.mnemonic.length
                                                      )}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                onClick={() =>
                                                    togglePrivateKeyVisibility(
                                                        index
                                                    )
                                                }>
                                                {visiblePrivateKeys[index] ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default WalletGenerator;
