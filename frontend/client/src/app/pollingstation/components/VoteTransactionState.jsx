'use client';

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import Notification from "../../../components/Notification";
import Loading from '../../../components/Loading';
import { AlreadyVotedError, ServerError, getTransactionState } from '../../../service';
import styles from './../styles/VoteTransactionState.module.css';
import { useTranslation } from "next-i18next";

export default function VoteResultView(props) {
    const { taskId } = props;
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [transactionViewUrl, setTransactionViewUrl] = useState();

    const [voteResultState, setVoteResultState] = useState({
        transactionState: t('votetransactionstate.status.checking'),
        showLoading: true,
        showNotification: false,
        notificationText: '',
        notificationType: '',
    });

    const checkTransaction = async () => {
        try {
            const transactionResult = await getTransactionState(taskId);
            if (transactionResult.transactionHash.length > 0) {
                setTransactionHash(transactionResult.transactionHash);
                setTransactionViewUrl(transactionResult.transactionViewUrl);
            }

            if (transactionResult.status === 'pending') {
                let transactionPendingDelay = 1000;
                setVoteResultState({
                    ...voteResultState,
                    transactionState: t('votetransactionstate.status.pending'),
                    showLoading: true,
                    showNotification: false,
                });
                transactionPendingDelay = transactionPendingDelay * 2;
                setTimeout(() => {
                    checkTransaction();
                }, transactionPendingDelay);
            }

            if (transactionResult.status === 'success') {
                setVoteResultState({
                    ...voteResultState,
                    transactionState: t('votetransactionstate.status.success'),
                    showLoading: false,
                    showNotification: true,
                    notificationText: t('votetransactionstate.info.success'),
                    notificationType: 'success',
                });
            }

            if (transactionResult.status === 'cancelled') {
                setVoteResultState({
                    ...voteResultState,
                    transactionState: t('votetransactionstate.status.error'),
                    showLoading: false,
                    showNotification: true,
                    notificationText: t('votetransactionstate.error.transaction'),
                    notificationType: 'error',
                });
            }
        } catch (error) {
            let notificationText;
            let errorDelay = 10000; // reload after
            if (error instanceof ServerError) {
                notificationText = t('votetransactionstate.error.servererror');
            } else if (error instanceof AlreadyVotedError) {
                setVoteResultState({
                    ...voteResultState,
                    transactionState: t('votetransactionstate.status.error'),
                    showLoading: false,
                    showNotification: true,
                    notificationType: 'error',
                    notificationText: t('votetransactionstate.error.alreadyvoted'),
                });
                return;
            } else {
                console.log(error);
                notificationText = t('votetransactionstate.error.unknown');
            }
            setTimeout(() => {
                checkTransaction();
            }, errorDelay);
            setVoteResultState({
                ...voteResultState,
                showLoading: true,
                showNotification: true,
                notificationType: 'error',
                notificationText: notificationText,
            });
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
                <Loading loadingText={t('votetransactionstate.status.checking')} />
            )}

            <div className={styles.flex}>
                <div className={styles.item}>
                    <span className={styles.itemvalue}>{voteResultState.transactionState}</span>
                    <h3 className={styles.itemheadline}>{t('votetransactionstate.status')}</h3>
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
                    <h3 className={styles.itemheadline}>{t('votetransactionstate.transaction')}</h3>
                </div>
            </div>
        </>
    )
}

