'use client';
import styles from "../styles/ElectionHeader.module.css";

export default function CountDownDisplay(props) {
    const { leftValue, leftUnit } = props;
    return (
        <>
            <div className={styles.timer_item}>
                <h3>{leftValue}</h3>
                {leftUnit}
            </div>
        </>
    );
}
