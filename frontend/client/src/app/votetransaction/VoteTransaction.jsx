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

export default function VoteTransaction() {
    const { taskId, voting, updateVoting, updateTaskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [transactionViewUrl, setTransactionViewUrl] = useState();

    const [voteResultState, setVoteResultState] = useState({
        transactionState: t('votetransactionstate.statustitle.checking'),
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
                    transactionState: t('votetransactionstate.statustitle.pending'),
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
                    transactionState: t('votetransactionstate.statustitle.success'),
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
                    transactionState: t('votetransactionstate.statustitle.error'),
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
                    transactionState: t('votetransactionstate.statustitle.error'),
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
                transactionState: t('votetransactionstate.statustitle.success'),
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

            {voteResultState.showNotification && (
                <div className="op__margin_minus_3_top op__mob_padding_standard_left_right">
                    <Notification
                        type={voteResultState.notificationType}
                        text={voteResultState.notificationText}
                    />
                </div>
            )}

            {voteResultState.showLoading && (
                <div className="op__margin_standard_top op__padding_standard_top">
                    <Loading />
                </div>
            )}

            <div className="op__contentbox_max op__center-align op__padding_standard">
                <div className={styles.item}>
                    <span className={styles.itemvalue}>{voteResultState.transactionState}</span>
                    <h3 className={styles.itemheadline}>
                        {voting.transactionViewUrl ? (
                            <Trans
                                i18nKey="votetransactionstate.statusWithLink"
                                components={{
                                    CustomLink: <BlockchainLinkText transactionViewUrl={voting.transactionViewUrl} />
                                }}
                            />
                        ) : (
                            <>{t('votetransactionstate.status')}</>
                        )}
                    </h3>
                </div>
            </div>
        </>
    )
}
