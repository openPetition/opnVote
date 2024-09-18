'use client';
import React, { useState, useEffect } from "react";
import Link from 'next/link';
import Notification from "../../../components/Notification";
import Loading from '../../../components/Loading';
import { getTransactionState } from '../../../service';
import styles from './../styles/VoteTransactionState.module.css';

export default function VoteResultView(props) {
    const { taskId } = props;

    const [ transactionHash, setTransactionHash ] = useState();
    const [ transactionViewUrl, setTransactionViewUrl ] = useState();

    const [ voteResultState, setVoteResultState ] = useState({
        transactionState: 'Wird Abgefragt',
        showLoading: true,
        showNotification: false,
        notificationText: '',
        notificationType: ''
    });

    const checkTransaction = async () => {
        const transactionResult = await getTransactionState(taskId);
    
        if (transactionResult.transactionHash.length > 0) {
            setTransactionHash(transactionResult.transactionHash);
            setTransactionViewUrl(transactionResult.transactionViewUrl);
        }

        if (transactionResult.status === 'pending') {
            let transactionPendingDelay = 1000;
            setVoteResultState({
                ...voteResultState,
                transactionState: 'In Verarbeitung... ',
                showLoading: true,
                showNotification: false,
            })
            transactionPendingDelay = transactionPendingDelay * 2;
            setTimeout(() => {
                checkTransaction();
            }, transactionPendingDelay);
        }

        if (transactionResult.status === 'success') {
            setVoteResultState({
                ...voteResultState,
                transactionState: 'Erfolgreich',
                showLoading: false,
                showNotification: true,
                notificationText: 'Ihre Stimme wurde erfolgreich abgegeben, verschlüsselt und unveränderlich in die Blockchain geschrieben.',
                notificationType: 'success'
            })
        }

        if (transactionResult.status === 'cancelled') {
            setVoteResultState({
                ...voteResultState,
                transactionState: 'Fehler',
                showLoading: false,
                showNotification: true,
                notificationText: 'Die Transaktion ist fehlerhaft. Bitte wenden Sie sich an die Wahlleitung.',
                notificationType: 'error'
            })
        }
    } 

    useEffect(() => {
        if (taskId?.length > 0) {
            checkTransaction();
        }
    }, [taskId]);

    return (
      <>
            {voteResultState.showNotification && (
                <Notification type={voteResultState.notificationType} text={voteResultState.notificationText} />
            )}

            {voteResultState.showLoading && (
                <Loading loadingText="Abfrage läuft" />
            )}

            <div className={styles.flex}>
                <div className={styles.item}>
                    <span className={styles.itemvalue}>{voteResultState.transactionState}</span>
                    <h3 className={styles.itemheadline}>Status</h3>
                </div>
                <div className={styles.item}>
                    {transactionHash && (
                        <Link target="_blank" className={styles.itemvalue} href={transactionViewUrl}>
                            {transactionHash}
                        </Link>
                    )}
                     {!transactionHash && (
                        <span className={styles.itemvalue}>
                             ---
                        </span>
                    )}
                    <h3 className={styles.itemheadline}>Blockchain Transaktion</h3>
                </div>
            </div>
      </>
    )
}

