'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation, Trans } from "next-i18next";
import Button from '@/components/Button';
import Loading from '@/components/Loading';
import Headline from "@/components/Headline";
import Notification from '@/components/Notification';
import ErrorPopup from '@/components/ErrorPopup';
import { VoteTransactionError, VoteTransactionPendingError } from '@/errors';
import { AlreadyVotedError, ServerError, querySubgraphTransactionState } from '../../service';
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import styles from './styles/votetransaction.module.css';
import globalConst from "@/constants";
import { Check, TriangleAlert } from "lucide-react";
import { useVoting } from '../VotingContext';

export default function VoteTransaction() {
    const { voting, user, updateVoting, updatePage, voteClient, hashes } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [isCheckingTransaction, setIsCheckingTransaction] = useState(false);
    const [transactionErrorDetails, setTransactionErrorDetails] = useState(null);
    const [errorPopup, setErrorPopup] = useState(null);
    const { smartAccountClient } = useVoting(); // Holt den fertigen Client aus Seite 1

    const TRANSACTION_STATE_CHECKING = 'checking';
    const TRANSACTION_STATE_PENDING = 'pending';
    const TRANSACTION_STATE_SUCCESS = 'success';
    const TRANSACTION_STATE_ERROR = 'error';
    const TRANSACTION_STATE_ERROR_RETRY = 'error-retry';

    const TRANSACTION_PENDING_DELAY = 6000; // in milli seconds

    const [voteResultState, setVoteResultState] = useState({
        transactionStateText: t('votetransactionstate.statustitle.checking'),
        transactionStateSubText: '',
        transactionState: TRANSACTION_STATE_CHECKING,
        transactionStart: new Date().getTime(),
        notificationText: '',
        notificationType: '',
    });

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const retryTransactionCheck = () => {
        setTransactionErrorDetails(null);
        setVoteResultState((previousState) => ({
            ...previousState,
            transactionStateText: t('votetransactionstate.statustitle.checking'),
            transactionStateSubText: '',
            transactionState: TRANSACTION_STATE_CHECKING,
            notificationText: '',
            notificationType: '',
        }));
        setIsCheckingTransaction(true);
    };

    const checkTransaction = async () => {
        if (voteClient && typeof voteClient.registerVoter === 'function') {
            try {
                let credentials = null;
                let response = "";
                credentials = voteClient.importCredentials(voting.registerCode);
                const requestObj = voting.isVoteRecast ? { credentials: credentials, txHash: hashes.txHash } : { credentials: credentials };
                for (let attempt = 1; attempt <= 10; attempt++) {
                    response = await voteClient.checkVote(requestObj);
                    if (response && response.ok && response.value.indexed) {
                        setTransactionHash(response.value.txHash);
                        updateVoting({ votesuccess: true });
                        setVoteResultState({
                            ...voteResultState,
                            transactionStateText: t('votetransactionstate.statustitle.success'),
                            transactionStateSubText: t('votetransactionstate.statustext.success'),
                            transactionState: TRANSACTION_STATE_SUCCESS,
                            notificationText: t('votetransactionstate.info.success'),
                            notificationType: 'success',
                        });
                        break;
                    } else {
                        if (attempt === 10) {
                            const userError = new VoteTransactionPendingError();
                            setTransactionErrorDetails({
                                userError,
                                location: userError.title,
                                notificationType: 'attention',
                                openTechnicalDetails: true,
                                module: 'VoteTransaction',
                                block: 'checkTransaction',
                                technicalDetails: 'The transaction was not indexed after 10 attempts.',
                            });
                            setVoteResultState({
                                ...voteResultState,
                                transactionStateText: t('votetransactionstate.statustitle.pending'),
                                transactionStateSubText: '',
                                transactionState: TRANSACTION_STATE_PENDING,
                                notificationType: 'attention',
                                notificationText: t('votetransactionstate.pending.text'),
                            });
                        } else {
                            console.log(`Waiting for subgraph... (attempt ${attempt}/10)`);
                            await sleep(TRANSACTION_PENDING_DELAY);
                        }
                    }
                }
            } catch (error) {
                let notificationText;
                // @TODO distinguish different error types
                // notificationText = t('votetransactionstate.error.servererror');
                // notificationText = t('votetransactionstate.error.alreadyvoted')
                notificationText = t('votetransactionstate.error.unknown');
                setTransactionErrorDetails({
                    userError: new VoteTransactionError(),
                    location: 'votetransactionstate.errorpopup.headline',
                    module: 'VoteTransaction',
                    block: 'checkTransaction',
                    technicalDetails: error instanceof Error
                        ? error.message || error.name
                        : t('errorpopup.technicaldetails.unavailable'),
                });
                updateVoting({ votesuccess: false });
                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionStateSubText: '',
                    transactionState: TRANSACTION_STATE_ERROR,
                    notificationType: 'error',
                    notificationText: notificationText,
                });
            }
        }
    };

    const BlockchainLinkText = (props) => {
        const { transactionHash } = props;
        const shortLink = `https://gnosisscan.io/tx/${transactionHash}`;
        return (
            <Link
                target="_blank"
                href={shortLink}
            >
                {props.children}
            </Link>
        );
    };

    useEffect(() => {
        if (isCheckingTransaction) {
            setIsCheckingTransaction(false);
            checkTransaction();
        }
    }, [isCheckingTransaction]);

    useEffect(() => {
        // be sure, that we only call it once at first
        if (hashes.userOpHash?.length > 0 && voteResultState.transactionState === TRANSACTION_STATE_CHECKING) {
            setIsCheckingTransaction(true);
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
    }, [hashes]);

    return (
        <>
            <Headline
                title={t("votetransactionstate.headline.title")}
                backgroundImage="successbanner"
            />

            <div className={styles.loadingContainer}>
                <div className={styles.loading}>
                    {voteResultState.transactionState === TRANSACTION_STATE_SUCCESS ? (
                        <Check width={70} height={70} style={{ color: "#29B0CC" }} strokeWidth={1} />
                    ) : voteResultState.transactionState === TRANSACTION_STATE_PENDING ? (
                        <TriangleAlert
                            width={70}
                            height={70}
                            style={{ color: "#9A6700" }}
                            strokeWidth={1}
                            aria-label={t('votetransactionstate.pending.popup.headline')}
                        />
                    ) : (
                        <Loading />
                    )}
                </div>
            </div>

            <div className="op__contentbox_max op__center-align op__padding_standard">
                <div className={styles.item}>
                    {voteResultState.transactionState !== TRANSACTION_STATE_PENDING && (
                        <>
                            <h3 className={styles.itemvalue}>{voteResultState.transactionStateText}</h3>
                            <div className={styles.itemlabel}>{voteResultState.transactionStateSubText}</div>
                        </>
                    )}
                    <div className={styles.itemheadline}>
                        {transactionHash ? (
                            <>
                                <p className="op__padding_standard_bottom">
                                    <Trans
                                        i18nKey="votetransactionstate.statusWithLink"
                                        components={{
                                            CustomLink: <BlockchainLinkText transactionHash={transactionHash} />
                                        }}
                                    />
                                </p>
                                {voting.electionId == 15 && (<>
                                    <p className="op__padding_standard_bottom" dangerouslySetInnerHTML={{ __html: t("votetransactionstate.election15.1") }} />
                                    <p className="op__padding_standard_bottom" dangerouslySetInnerHTML={{ __html: t("votetransactionstate.election15.2") }} />
                                </>)}
                            </>
                        ) : (
                            voteResultState.transactionState === TRANSACTION_STATE_ERROR || voteResultState.transactionState === TRANSACTION_STATE_PENDING ? (
                                <Notification
                                    type={voteResultState.notificationType}
                                    text={voteResultState.notificationText}
                                    buttonText={voteResultState.transactionState === TRANSACTION_STATE_PENDING
                                        ? t('votetransactionstate.pending.retry')
                                        : undefined}
                                    buttonAction={voteResultState.transactionState === TRANSACTION_STATE_PENDING
                                        ? retryTransactionCheck
                                        : undefined}
                                    linkText={t(voteResultState.transactionState === TRANSACTION_STATE_PENDING
                                        ? 'votetransactionstate.pending.popup.link'
                                        : 'votetransactionstate.errorpopup.link')}
                                    linkAction={() => setErrorPopup(transactionErrorDetails)}
                                />
                            ) : (
                                <>{voteResultState.notificationText}</>
                            )
                        )}
                    </div>
                </div>
                {voteResultState.transactionState == TRANSACTION_STATE_ERROR_RETRY && (
                    <div className="op__padding_standard_top">
                        <Button type="primary" onClick={() => { updateUserOpHash(''); updatePage({ current: globalConst.pages.POLLINGSTATION }, modes.replace); }}>{t("votetransactionstate.errorretry")}</Button>
                    </div>
                )}
            </div>
            <ErrorPopup error={errorPopup} onClose={() => setErrorPopup(null)} />
        </>
    );
}
