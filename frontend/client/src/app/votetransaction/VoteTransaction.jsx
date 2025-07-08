'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation, Trans } from "next-i18next";
import Notification from "@/components/Notification";
import Loading from '@/components/Loading';
import Headline from "@/components/Headline";
import { AlreadyVotedError, ServerError, getTransactionState } from '../../service';
import { useOpnVoteStore } from "../../opnVoteStore";
import styles from './styles/votetransaction.module.css';
import globalConst from "@/constants";
import { Check } from "lucide-react";

export default function VoteTransaction() {
    const { taskId, voting, updateVoting, updateTaskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [transactionViewUrl, setTransactionViewUrl] = useState();

    const TRANSACTION_STATE_CHECKING = 'checking';
    const TRANSACTION_STATE_PENDING = 'pending';
    const TRANSACTION_STATE_SUCCESS = 'success';
    const TRANSACTION_STATE_ERROR = 'error';

    const [voteResultState, setVoteResultState] = useState({
        transactionStateText: t('votetransactionstate.statustitle.checking'),
        transactionState: TRANSACTION_STATE_CHECKING,
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
                    transactionStateText: t('votetransactionstate.statustitle.pending'),
                    transactionState: TRANSACTION_STATE_PENDING,
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
                    transactionStateText: t('votetransactionstate.statustitle.success'),
                    transactionState: TRANSACTION_STATE_SUCCESS,
                    showLoading: false,
                    showNotification: true,
                    notificationText: t('votetransactionstate.info.success'),
                    notificationType: 'success',
                });
                updateVoting({
                    votesuccess: true,
                    transactionViewUrl: transactionResult.transactionViewUrl
                });
                updateTaskId(''); //invalidation to prevent wrong redirects from pollingstation
            }

            if (transactionResult.status === 'cancelled') {
                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionState: TRANSACTION_STATE_ERROR,
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
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionState: TRANSACTION_STATE_ERROR,
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
                transactionState: TRANSACTION_STATE_ERROR,
                showLoading: true,
                showNotification: true,
                notificationType: 'error',
                notificationText: notificationText,
            });
        }
    };

    const BlockchainLinkText = (props) => {
        const { transactionViewUrl } = props;
        return (
            <Link target="_blank" href={transactionViewUrl}>
                {props.children}
            </Link>
        );
    };

    useEffect(() => {
        if (taskId?.length > 0) {
            checkTransaction();
            return;
        }
        if (voting.votesuccess) {
            setVoteResultState({
                ...voteResultState,
                transactionStateText: t('votetransactionstate.statustitle.success'),
                transactionState: TRANSACTION_STATE_SUCCESS,
                showLoading: false,
                showNotification: true,
                notificationText: t('votetransactionstate.info.success'),
                notificationType: 'success',
            });
        }
    }, [taskId]);

    return (
        <>
            <title>{t("votetransactionstate.title")}</title>
            <Headline
                title={t("votetransactionstate.headline.title")}
                text={t("votetransactionstate.headline.text")}
                backgroundImage="successbanner"
            />

                <div className={styles.loadingContainer}>
                    <div className={styles.loading}>
                        {voteResultState.transactionState == TRANSACTION_STATE_SUCCESS && (
                            <Check width={70} height={70} style={{color: "#29B0CC"}} strokeWidth={1} />
                        ) || (
                            <Loading />
                        )}
                    </div>
                </div>

            <div className="op__contentbox_max op__center-align op__padding_standard">
                <div className={styles.item}>
                    <h3 className={styles.itemvalue}>{voteResultState.transactionStateText}</h3>
                    <div className={styles.itemlabel}>{t('votetransactionstate.statuslabel')}</div>
                    <div className={styles.itemheadline}>
                        {voting.transactionViewUrl ? (
                            <Trans
                                i18nKey="votetransactionstate.statusWithLink"
                                components={{
                                    CustomLink: <BlockchainLinkText transactionViewUrl={voting.transactionViewUrl} />
                                }}
                            />
                        ) : (
                            <>{voteResultState.notificationText}</>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
