'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation, Trans } from "next-i18next";
import Button from '@/components/Button';
import Notification from "@/components/Notification";
import Loading from '@/components/Loading';
import Headline from "@/components/Headline";
import { AlreadyVotedError, ServerError, getTransactionState, gelatoVerify } from '../../service';
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import styles from './styles/votetransaction.module.css';
import globalConst from "@/constants";
import { Check } from "lucide-react";

export default function VoteTransaction() {
    const { taskId, voting, updateVoting, updateTaskId, updatePage } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [transactionViewUrl, setTransactionViewUrl] = useState();

    const TRANSACTION_STATE_CHECKING = 'checking';
    const TRANSACTION_STATE_PENDING = 'pending';
    const TRANSACTION_STATE_SUCCESS = 'success';
    const TRANSACTION_STATE_ERROR = 'error';
    const TRANSACTION_STATE_ERROR_RETRY = 'error-retry';

    const TRANSACTION_PENDING_DELAY = 1000; // in milli seconds
    const TRANSACTION_GELATO_TIMEOUT = 30000;

    const [voteResultState, setVoteResultState] = useState({
        transactionStateText: t('votetransactionstate.statustitle.checking'),
        transactionStateSubText: '',
        transactionState: TRANSACTION_STATE_CHECKING,
        transactionStart: new Date().getTime(),
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
                let now = new Date().getTime();
                let pendingInMilliseconds = now - voteResultState.transactionStart;

                if (pendingInMilliseconds > TRANSACTION_GELATO_TIMEOUT) {
                    let gelatoState = await gelatoVerify(taskId);

                    if (gelatoState.onChainStatus.confirmed) {
                        updateTaskId(''); //invalidation to prevent wrong redirects from pollingstation

                        updateVoting({
                            votesuccess: true,
                            transactionViewUrl: transactionResult.transactionViewUrl,
                        });

                        setVoteResultState({
                            ...voteResultState,
                            transactionStateText: t('votetransactionstate.statustitle.success'),
                            transactionStateSubText: t('votetransactionstate.statustext.success'),
                            transactionState: TRANSACTION_STATE_SUCCESS,
                            notificationText: t('votetransactionstate.info.success'),
                            notificationType: 'success',
                        });

                        return;
                    }
                }

                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.pending'),
                    transactionStateSubText: t('votetransactionstate.statustext.pending'),
                    transactionState: TRANSACTION_STATE_PENDING,
                });
                return;
            }

            if (transactionResult.status === 'success') {
                updateVoting({
                    votesuccess: true,
                    transactionViewUrl: transactionResult.transactionViewUrl,
                });
                updateTaskId(''); //invalidation to prevent wrong redirects from pollingstation

                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.success'),
                    transactionStateSubText: t('votetransactionstate.statustext.success'),
                    transactionState: TRANSACTION_STATE_SUCCESS,
                    notificationText: t('votetransactionstate.info.success'),
                    notificationType: 'success',
                });
            }

            if (transactionResult.status === 'cancelled') {
                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionStateSubText: '',
                    transactionState: TRANSACTION_STATE_ERROR_RETRY,
                    notificationText: t('votetransactionstate.error.transaction'),
                    notificationType: 'error',
                });
            }
        } catch (error) {
            let notificationText;
            if (error instanceof ServerError) {
                notificationText = t('votetransactionstate.error.servererror');
            } else if (error instanceof AlreadyVotedError) {
                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionStateSubText: '',
                    transactionState: TRANSACTION_STATE_ERROR,
                    notificationType: 'error',
                    notificationText: t('votetransactionstate.error.alreadyvoted'),
                });
                return;
            } else {
                notificationText = t('votetransactionstate.error.unknown');
            }

            setVoteResultState({
                ...voteResultState,
                transactionState: TRANSACTION_STATE_ERROR,
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
        if (voteResultState.transactionState === TRANSACTION_STATE_PENDING) {
            setTimeout(() => {
                checkTransaction();
            }, TRANSACTION_PENDING_DELAY);
        }
    }, [voteResultState]);

    useEffect(() => {
        // be sure, that we only call it once at first
        if (taskId?.length > 0 && voteResultState.transactionState === TRANSACTION_STATE_CHECKING) {
            checkTransaction();
            return;
        }
        if (voting.votesuccess) {
            setVoteResultState({
                ...voteResultState,
                transactionStateText: t('votetransactionstate.statustitle.success'),
                transactionStateSubText: t('votetransactionstate.statustext.success'),
                transactionState: TRANSACTION_STATE_SUCCESS,
                notificationText: t('votetransactionstate.info.success'),
                notificationType: 'success',
            });
        }
    }, [taskId]);

    return (
        <>
            <Headline
                title={t("votetransactionstate.headline.title")}
                backgroundImage="successbanner"
            />

            <div className={styles.loadingContainer}>
                <div className={styles.loading}>
                    {voteResultState.transactionState == TRANSACTION_STATE_SUCCESS && (
                        <Check width={70} height={70} style={{ color: "#29B0CC" }} strokeWidth={1} />
                    ) || (
                            <Loading />
                        )}
                </div>
            </div>

            <div className="op__contentbox_max op__center-align op__padding_standard">
                <div className={styles.item}>
                    <h3 className={styles.itemvalue}>{voteResultState.transactionStateText}</h3>
                    <div className={styles.itemlabel}>{voteResultState.transactionStateSubText}</div>
                    <div className={styles.itemheadline}>
                        {voting.transactionViewUrl ? (
                            <>
                                <p className="op__padding_standard_bottom">
                                    <Trans
                                        i18nKey="votetransactionstate.statusWithLink"
                                        components={{
                                            CustomLink: <BlockchainLinkText transactionViewUrl={voting.transactionViewUrl} />
                                        }}
                                    />
                                </p>
                                {voting.electionId == 15 && (<>
                                    <p className="op__padding_standard_bottom" dangerouslySetInnerHTML={{ __html: t("votetransactionstate.election15.1") }}/>
                                    <p className="op__padding_standard_bottom" dangerouslySetInnerHTML={{ __html: t("votetransactionstate.election15.2") }}/>
                                </>)}
                            </>
                        ) : (
                            <>{voteResultState.notificationText}</>
                        )}
                    </div>
                </div>
                {voteResultState.transactionState == TRANSACTION_STATE_ERROR_RETRY && (
                    <div className="op__padding_standard_top">
                        <Button type="primary" onClick={() => {updateTaskId(''); updatePage({current: globalConst.pages.POLLINGSTATION}, modes.replace);}}>{t("votetransactionstate.errorretry")}</Button>
                    </div>
                )}
            </div>
        </>
    );
}
