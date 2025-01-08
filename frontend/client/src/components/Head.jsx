'use client';

import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";

export default function Head() {

    const { user, updateUserKey } = useOpnVoteStore((state) => state);

    const deleteUserKey = () => updateUserKey('');

    return (
        <>
            <div className={styles.header}>

                {user?.key && (
                    <>
                        {user.key} <div onClick={deleteUserKey}>Deletebutton</div>
                    </>
                )}

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
