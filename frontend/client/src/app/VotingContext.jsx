'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const VotingContext = createContext(null);

export function VotingProvider({ children }) {
    const [smartAccountClient, setSmartAccountClient] = useState(null);
    useEffect(() => {
        console.log(smartAccountClient);
    }, [smartAccountClient]);
    return (
        <VotingContext.Provider value={{ smartAccountClient, setSmartAccountClient }}>
            {children}
        </VotingContext.Provider>
    );
}

export const useVoting = () => useContext(VotingContext);