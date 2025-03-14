'use client';
import styles from './../styles/Loading.module.css';

/**
 * color can be blue, darkgrey
 * size can be small, middle
 */
export default function Loading(props) {
    const { loadingText, theme } = props;
    let themeClass = theme ? theme : 'default';

    return (
        <>
            <div className={styles.loadingbox}>
                <div className={`${styles.loader} ${styles[themeClass]}`}></div>
                <h1>{loadingText}</h1>
            </div>
        </>
    );
}
