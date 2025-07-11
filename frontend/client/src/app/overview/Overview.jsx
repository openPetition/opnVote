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
    const { taskId, user, voting, updateVoting, updateTaskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [transactionHash, setTransactionHash] = useState();
    const [transactionViewUrl, setTransactionViewUrl] = useState();
    const [boxes, setBoxes] = useState({
        // id: { state: BOX_STATE_ACTIVATABLE, type: 'id' },
        // key: { state: BOX_STATE_ACTIVATABLE, type: 'key' },
        // ballot: { state: BOX_STATE_PASSIVE, type: 'ballot' },
        // vote: { state: BOX_STATE_PASSIVE, type: 'vote' },
        // id: { state: BOX_STATE_ACTIVE, type: 'id' },
        // key: { state: BOX_STATE_ACTIVE, type: 'key' },
        // ballot: { state: BOX_STATE_ACTIVE, type: 'ballot' },
        // vote: { state: BOX_STATE_ACTIVE, type: 'vote' },
        // id: { state: BOX_STATE_PASSIVE, type: 'id' },
        // key: { state: BOX_STATE_PASSIVE, type: 'key' },
        // ballot: { state: BOX_STATE_PASSIVE, type: 'ballot' },
        // vote: { state: BOX_STATE_PASSIVE, type: 'vote' },
        id: { state: BOX_STATE_ACTIVATABLE, type: 'id' },
        key: { state: BOX_STATE_ACTIVATABLE, type: 'key' },
        ballot: { state: BOX_STATE_ACTIVATABLE, type: 'ballot' },
        vote: { state: BOX_STATE_ACTIVATABLE, type: 'vote' },

    });
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
                {tinyIcon[boxes.id.state]}
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
            <Box box={boxes.key}>
                <BoxHead>
                    <BoxIcon box={boxes.key} />
                    <h3>{t('overview.box.key.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.key.text')}</p>
                <Buttons>
                    {box.state == BOX_STATE_ACTIVATABLE && (<>
                        <Button className={styles.boxButtonActive} onClick={() => {  }}>{t("overview.box.key.button.create")}</Button>
                        <Button>{t("overview.box.key.button.load")}</Button>
                    </>)}
                    {box.state == BOX_STATE_ACTIVE && (
                        <Button>{t("overview.box.key.button.remove")}</Button>
                    )}
                </Buttons>
            </Box>
        );
    };

    const BoxBallot = function ({ box }) {
        return (
            <Box box={boxes.ballot}>
                <BoxHead>
                    <BoxIcon box={boxes.ballot} />
                    <h3>{t('overview.box.ballot.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.ballot.text')}</p>
                {box.state == BOX_STATE_ACTIVATABLE && box.future && (
                    <p dangerouslySetInnerHTML={{ __html: t('overview.box.ballot.future', { REGISTERSTART: box.future }) }}></p>
                )}
                {box.state == BOX_STATE_ACTIVATABLE && box.past && (
                    <p>{t('overview.box.ballot.past')}</p>
                )}
                <Buttons>
                    {box.state == BOX_STATE_ACTIVATABLE && !box.future && !box.past && (<>
                        <Button className={styles.boxButtonActive}>{t("overview.box.ballot.button.register")}</Button>
                        <Button className={styles.boxButtonActive}>{t("overview.box.ballot.button.load")}</Button>
                    </>
                    )}
                    {box.state == BOX_STATE_ACTIVE && (
                        <Button>{t("overview.box.ballot.button.remove")}</Button>
                    )}
                </Buttons>
            </Box >
        );
    };

    const BoxVote = function ({ box }) {
        return (
            <Box box={boxes.vote}>
                <BoxHead>
                    <BoxIcon box={boxes.vote} />
                    <h3>{t('overview.box.vote.title')}</h3>
                </BoxHead>
                <p>{t('overview.box.vote.text')}</p>
                {box.state == BOX_STATE_ACTIVATABLE && box.future && (
                    <p dangerouslySetInnerHTML={{ __html: t('overview.box.vote.future', { VOTESTART: box.future }) }} />
                )}
                {box.state == BOX_STATE_ACTIVATABLE && box.past && (
                    <p>{t('overview.box.vote.past')}</p>
                )}
                <Buttons>
                    <Button>{t('overview.box.vote.button')}</Button>
                </Buttons>
            </Box>
        );
    };

    useEffect(() => {
        // waiting for logic, to set boxes to their appropriate states
    }, [voting, user]);

    return (
        <>
            <title>{t("overview.title")}</title>
            <Headline
                title={t("overview.headline.title")}
                text={t("overview.headline.text")}
            />
            {voting.electionId && (
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
