'use client';

import styles from '../styles/Button.module.css';

export default function Button({ type, stretched, children, ...props }) {

    return (
        <>
            <button
                {...props}
                className={`${styles.btn} ${styles[type]} ${stretched ? 'op__width_100' : ''}`}
            >
                {children}
            </button>
        </>
    );
}
