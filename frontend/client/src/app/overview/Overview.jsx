'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation, Trans } from "next-i18next";
import Notification from "@/components/Notification";
import Loading from '@/components/Loading';
import Headline from "@/components/Headline";
import { AlreadyVotedError, ServerError, getTransactionState } from '../../service';
import { useOpnVoteStore } from "../../opnVoteStore";
import styles from './styles/overview.module.css';
import globalConst from "@/constants";
import ElectionInfoBox from "../register/components/ElectionInfoBox";
import PhaseIcon from "@/components/PhaseIcon";
import { Check, X } from "lucide-react";

const BOX_STATE_ACTIVE = 'Active';
const BOX_STATE_ACTIVATABLE = 'Activatable';
const BOX_STATE_PASSIVE = 'Passive';

export default function Overview() {
    const { user, voting, updateVoting, updatePage, updateUserKey, updateTaskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [boxes, setBoxes] = useState({
        id: { state: BOX_STATE_ACTIVATABLE, type: 'id' },
        key: { state: BOX_STATE_ACTIVATABLE, type: 'key', canRegister: false },
        ballot: { state: BOX_STATE_ACTIVATABLE, type: 'ballot', future: null, past: null, canVote: false },
        vote: { state: BOX_STATE_ACTIVATABLE, type: 'vote', future: null, past: null },
    });

    const goToPage = function (newPage) {
        updatePage({ current: newPage });
    };
    const deleteBallot = () => {
        updateVoting({ registerCode: '' });
        updateTaskId('');
    };

    const line = (
        <div className={styles.line}></div>
    );

    const Box = function ({ children, box }) {
        const boxClass = {
            [BOX_STATE_ACTIVE]: styles.boxActive,
            [BOX_STATE_PASSIVE]: styles.boxPassive,
            [BOX_STATE_ACTIVATABLE]: styles.boxActivatable,
        };

        return <div className={`${styles.box} ${boxClass[box.state]}`}>
            {children}
        </div>;
    };

    const BoxHead = function ({ children }) {
        return <div className={styles.boxHead}>{children}</div>;
    };

    const BoxIcon = function ({ box }) {
        const variantMap = {
            [BOX_STATE_ACTIVE]: 'blue',
            [BOX_STATE_PASSIVE]: 'black',
            [BOX_STATE_ACTIVATABLE]: 'black',
        };
        const tinyIcon = {
            [BOX_STATE_ACTIVE]: (<div className={styles.activeIcon}><Check width={12} height={12} strokeWidth={4} /></div>),
            [BOX_STATE_PASSIVE]: (<div className={styles.inactiveIcon}><X width={12} height={12} strokeWidth={4} /></div>),
            [BOX_STATE_ACTIVATABLE]: (<div className={styles.inactiveIcon}><X width={12} height={12} strokeWidth={4} /></div>),
        };

        return (
            <div className={styles.iconContainer}>
                <PhaseIcon variant={variantMap[box.state]} type={box.type} />
                {tinyIcon[box.state]}
            </div>
        );
    };

    const Buttons = function ({ children }) {
        if (!children) {
            return null;
        }

        return (<>
            <div className={styles.boxFiller} />
            <div className={styles.boxButtons}>
                {children}
            </div>
        </>);
    };

    const Button = function ({ className, children, ...props }) {
        return <a className={`${styles.boxButton} ${className}`} {...props}>{children}</a>;
    };

    const BoxId = function ({ box }) {
        return <Box box={box}>
            <BoxHead>
                <BoxIcon box={box} />
                <h3>{t('overview.box.id.title')}</h3>
            </BoxHead>
            <p>{
                box.state == BOX_STATE_ACTIVE
                    ? t('overview.box.id.text.active')
                    : <Trans i18nKey="overview.box.id.text.activatable"
                        components={{ A: <Link href="https://www.openpetition.de/opn-vote" /> }}
                    />
            }</p>
            <Buttons>
                {box.state == BOX_STATE_ACTIVATABLE && (
                    <Button href="https://www.openpetition.de/opn-vote">{t("overview.box.id.button")}</Button>
                )}
            </Buttons>
        </Box >;
    };

    const BoxKey = function ({ box }) {
        return (
            <Box box={box}>
                <BoxHead>
                    <BoxIcon box={box} />
                    <h3>{t('overview.box.key.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.key.text')}</p>
                <Buttons>
                    {box.state == BOX_STATE_ACTIVATABLE && box.canRegister && voting.jwt && (<>
                        <Button className={styles.boxButtonActive} onClick={() => goToPage(globalConst.pages.CREATEKEY)}>{t("overview.box.key.button.create")}</Button>
                        <Button onClick={() => goToPage(globalConst.pages.LOADKEY)}>{t("overview.box.key.button.load")}</Button>
                    </>)}
                    {box.state == BOX_STATE_ACTIVE && user.key && (<>
                        <Button onClick={() => updateUserKey('')}>{t("overview.box.key.button.remove")}</Button>
                        <Button onClick={() => goToPage(globalConst.pages.SHOWKEY)}>{t("overview.box.key.button.save")}</Button>
                    </>)}
                    {box.state == BOX_STATE_ACTIVE && !user.key && (<>
                        <Button onClick={() => goToPage(globalConst.pages.LOADKEY)}>{t("overview.box.key.button.load")}</Button>
                    </>)}
                </Buttons>
            </Box>
        );
    };

    const BoxBallot = function ({ box }) {
        return (
            <Box box={box}>
                <BoxHead>
                    <BoxIcon box={box} />
                    <h3>{t('overview.box.ballot.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.ballot.text')}</p>
                {box.state == BOX_STATE_ACTIVATABLE && box.future && (
                    <p dangerouslySetInnerHTML={{ __html: t('overview.box.ballot.future', { REGISTERSTART: new Date(Number(box.future) * 1000) }) }}></p>
                )}
                {box.state == BOX_STATE_ACTIVATABLE && box.past && (
                    <p>{t('overview.box.ballot.past')}</p>
                )}
                <Buttons>
                    {box.state == BOX_STATE_ACTIVATABLE && !box.future && !box.past && (<>
                        {voting.jwt && user.key && Object.keys(voting.election).length > 0 && (
                            <Button className={styles.boxButtonActive} onClick={() => goToPage(globalConst.pages.REGISTER)}>{t("overview.box.ballot.button.register")}</Button>
                        )}
                        {box.canVote && (
                            <Button className={user.key ? '' : styles.boxButtonActive} onClick={() => goToPage(globalConst.pages.POLLINGSTATION)}>{t("overview.box.ballot.button.load")}</Button>
                        )}
                    </>
                    )}
                    {box.state == BOX_STATE_ACTIVE && (
                        <Button onClick={() => deleteBallot()}>{t("overview.box.ballot.button.remove")}</Button>
                    )}
                </Buttons>
            </Box >
        );
    };

    const BoxVote = function ({ box }) {
        return (
            <Box box={box}>
                <BoxHead>
                    <BoxIcon box={box} />
                    <h3>{t('overview.box.vote.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.vote.text')}</p>
                {box.state == BOX_STATE_ACTIVATABLE && box.future && (
                    <p dangerouslySetInnerHTML={{ __html: t('overview.box.vote.future', { VOTESTART: new Date(Number(box.future) * 1000) }) }} />
                )}
                {box.state == BOX_STATE_ACTIVATABLE && box.past && (
                    <p>{t('overview.box.vote.past')}</p>
                )}
                <Buttons>
                    {voting.registerCode && !box.future && !box.past && (
                        <Button className={styles.boxButtonActive} onClick={() => goToPage(globalConst.pages.POLLINGSTATION)}>{t('overview.box.vote.button')}</Button>
                    )}
                </Buttons>
            </Box>
        );
    };

    useEffect(() => {
        let newBoxes = {
            id: { state: BOX_STATE_ACTIVATABLE, type: 'id' },
            key: { state: BOX_STATE_ACTIVATABLE, type: 'key' },
            ballot: { state: BOX_STATE_ACTIVATABLE, type: 'ballot', past: null, future: null },
            vote: { state: BOX_STATE_ACTIVATABLE, type: 'vote', past: null, future: null },
        };
        const now = (new Date()).valueOf() / 1000;
        const hasElection = voting.electionId !== null && voting.electionId == voting.electionId;
        const registrationStartTime = voting.electionInformation?.registrationStartTime || voting.election?.votingStartTime || null;
        const registrationEndTime = voting.electionInformation?.registrationEndTime || voting.election?.votingEndTime || null;
        const votingStartTime = voting.election?.votingStartTime || null;
        const votingEndTime = voting.election?.votingEndTime || null;

        if (!hasElection) {
            newBoxes.key.state = BOX_STATE_PASSIVE;
            newBoxes.vote.state = BOX_STATE_PASSIVE;
            setBoxes(newBoxes);
            return; // abort, rest of code only relevant if there's an election
        }

        newBoxes.vote.future = now < votingStartTime ? votingStartTime : null;
        newBoxes.vote.past = votingEndTime < now ? votingEndTime : null;
        newBoxes.ballot.canVote = votingStartTime < now && now < votingEndTime;
        newBoxes.ballot.future = now < registrationStartTime ? registrationStartTime : null;
        newBoxes.ballot.past = registrationEndTime < now ? registrationEndTime : null;
        newBoxes.key.canRegister = registrationStartTime < now && now < registrationEndTime;

        if (voting.registerCode && voting.transactionViewUrl) {
            // there are votes in our local storage! activate all boxes
            newBoxes.id.state = BOX_STATE_ACTIVE;
            newBoxes.key.state = BOX_STATE_ACTIVE;
            newBoxes.ballot.state = BOX_STATE_ACTIVE;
            newBoxes.vote.state = BOX_STATE_ACTIVE;
        }
        if (user.key) {
            newBoxes.key.state = BOX_STATE_ACTIVE;
        }
        if (voting.jwt) {
            newBoxes.id.state = BOX_STATE_ACTIVE;
        }
        if (voting.registerCode) {
            newBoxes.id.state = BOX_STATE_ACTIVE;
            newBoxes.key.state = BOX_STATE_ACTIVE;
            newBoxes.ballot.state = BOX_STATE_ACTIVE;
        }

        setBoxes(newBoxes);
    }, [voting, user]);

    return (
        <>
            <Headline
                title={t("overview.headline.title")}
                text={t("overview.headline.text")}
            />
            {voting.electionId !== null && (
                <div className="op__contentbox_760">
                    <ElectionInfoBox />
                </div>
            )}

            <div className="op__contentbox_max op__padding_standard">
                <div className={styles.boxes}>
                    <BoxId box={boxes.id} />
                    {line}
                    <BoxKey box={boxes.key} />
                    {line}
                    <BoxBallot box={boxes.ballot} />
                    {line}
                    <BoxVote box={boxes.vote} />
                </div>
            </div >
        </>
    );
}
