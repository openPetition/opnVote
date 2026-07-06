'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation, Trans } from "next-i18next";
import Button from '@/components/Button';
import Loading from '@/components/Loading';
import Headline from "@/components/Headline";
import { AlreadyVotedError, ServerError, querySubgraphTransactionState } from '../../service';
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import styles from './styles/votetransaction.module.css';
import globalConst from "@/constants";
import { Check } from "lucide-react";
import { useVoting } from '../VotingContext';

export default function VoteTransaction() {
    const { voting, user, updateVoting, updatePage, voteClient, hashes } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
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

    const checkTransaction = async () => {

        if (voteClient && typeof voteClient.registerVoter === 'function') {
            try {
                let credentials = null;
                let response = "";
                credentials = voteClient.importCredentials(voting.registerCode);
                const requestObj = voting.isVoteRecast ? { credentials: credentials, txHash: hashes.txHash } : { credentials: credentials }
                for (let attempt = 1; attempt <= 10; attempt++) {
                    response = await voteClient.checkVote(requestObj);
                    if (respone && response.ok && response.value.indexed) {
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
                    }
                }
            } catch (error) {
                updateVoting({ votesuccess: true });
                setVoteResultState({
                    ...voteResultState,
                    transactionStateText: t('votetransactionstate.statustitle.error'),
                    transactionStateSubText: '',
                    transactionState: TRANSACTION_STATE_ERROR,
                    notificationType: 'error',
                    notificationText: t('votetransactionstate.error.unkown'),
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
        // be sure, that we only call it once at first
        if (hashes.userOpHash?.length > 0 && voteResultState.transactionState === TRANSACTION_STATE_CHECKING) {
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
    }, [hashes]);

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
                            <>{voteResultState.notificationText}</>
                        )}
                    </div>
                </div>
                {voteResultState.transactionState == TRANSACTION_STATE_ERROR_RETRY && (
                    <div className="op__padding_standard_top">
                        <Button type="primary" onClick={() => { updateUserOpHash(''); updatePage({ current: globalConst.pages.POLLINGSTATION }, modes.replace); }}>{t("votetransactionstate.errorretry")}</Button>
                    </div>
                )}
            </div>
        </>
    );
}
