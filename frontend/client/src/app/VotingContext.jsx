'use client';
import { createContext, useContext, useState } from 'react';

const VotingContext = createContext(null);

export function VotingProvider({ children }) {
    const [smartAccountClient, setSmartAccountClient] = useState(null);

    return (
        <VotingContext.Provider value={{ smartAccountClient, setSmartAccountClient }}>
            {children}
        </VotingContext.Provider>
    );
}

export const useVoting = () => useContext(VotingContext);