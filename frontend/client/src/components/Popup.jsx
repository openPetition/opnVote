'use client';
import styles from '../styles/Popup.module.css';
import Button from "./Button";
import Notification from './Notification';

/**
 * notificationType can be error, info, success or none - displey like in notification - only as popup
 * @param {*} props
 * @returns
 */
export default function Popup(props) {
    const { showModal, bodyText, headerText, buttonText, buttonFunction, notificationType } = props;

    function BodyContentDisplay(props) {
        const { bodyText, notificationType } = props;
        switch (notificationType) {
            case "none":
                return <>{bodyText}</>;
            default:
                return (
                    <Notification
                        type={notificationType}
                        text={bodyText}
                    />
                );
        }
    }

    return (
        <>
            {showModal && (
                <>
                    <div className={styles.popup}>
                        <div className={styles.popupContent}>
                            <h3 className={styles.popupHeader}>
                                <h2>{headerText}</h2>
                            </h3>
                            <div className={styles.popupBody}>
                                <BodyContentDisplay
                                    bodyText={bodyText}
                                    notificationType={notificationType}
                                />
                            </div>
                            {buttonText && (
                                <div className={styles.popupFooter}>
                                    <Button
                                        onClickAction={buttonFunction}
                                        text={buttonText}
                                        type="primary"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}