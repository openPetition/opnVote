'use client';

import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";
import { Trash2 } from 'lucide-react';

export default function Head() {

    const { user, updateUserKey } = useOpnVoteStore((state) => state);

    const Showkey = () => {
        const { user, updateUserKey } = useOpnVoteStore((state) => state);
        const deleteUserKey = () => updateUserKey('');
        if (user?.key) {
            return (
                <>
                    <strong className="op__padding_standard_left_right" >{user.key.substring(0, 7)}..</strong>
                    <span className="hover" onClick={deleteUserKey}><Trash2 size={18} /></span>
                </>);
        } else {
            return <span className="op__padding_standard_left_right"><strong>nicht vergeben</strong></span>;
        }
    }

    const ShowBallot = () => {
        return <span className="op__padding_standard_left_right"><strong>nicht vergeben</strong></span>;
    }

    return (
        <>
            <div className={styles.header}>
                <div className={styles.headerbar}>
                    <div className={styles.headerbar_content}>
                        <span className={styles.headerbar_point}><span>Wahlschlüssel: </span><Showkey /></span>
                        <span className={styles.headerbar_point}><span>Wahlschein: </span><ShowBallot /></span>
                        <span className={styles.headerbar_point}>Hilfe</span>
                    </div>
                </div>
                <Image
                    alt="open.vote logo"
                    src="/images/opnvote-logo.png"
                    height={68}
                    width={194}
                    style={{ margin: "1rem auto" }}
                />
            </div>
        </>
    );
}
