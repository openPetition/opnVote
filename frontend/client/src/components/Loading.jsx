'use client';
import React, {useState, useEffect} from "react";
import styles from './../styles/Loading.module.css';

export default function Loading(props) {
    const [isLoaded, setIsLoaded] = useState(false)

    const { loadingText } = props;

    useEffect(() => {
        setIsLoaded(true)
    }, [])

    return (
        <>
            <div className={styles.loadingbox}>
                <div className={styles.loader}></div>
                {isLoaded && (
                    <h1>{loadingText}</h1>
                )}
            </div>
        </>
    )
}