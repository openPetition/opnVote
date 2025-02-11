'use client';
import styles from './../styles/Loading.module.css';

export default function Loading(props) {
    const { loadingText } = props;
    return (
        <>
            <div className={styles.loadingbox}>
                <div className={styles.loader}></div>
                <h1>{loadingText}</h1>
            </div>
        </>
    );
}
