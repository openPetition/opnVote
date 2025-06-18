'use client';
import { useState, useEffect } from "react";
import styles from '../styles/Modal.module.css';
import Button from "./Button";
import { X } from 'lucide-react';

/**
 * @param {*} props
 * @returns
 */
export default function Modal(props) {
    const { showModal, headerText, children, ctaButtonText, ctaButtonFunction } = props;
    const [isOpen, setIsOpen] = useState();

    useEffect(() => {
        setIsOpen(showModal);
    }, [showModal]);

    useEffect(() => {
        setIsOpen(showModal);
    }, []);


    return (
        <>
            {isOpen && (
                <>
                    <div className={styles.popup}>
                        <div className={styles.popupContent}>

                            <div className={styles.close}>
                                <X
                                    fill="#fff"
                                    onClick={() => setIsOpen(false)}
                                />
                            </div>

                            {headerText && (
                                <h3 className={styles.popupHeader}>
                                    {headerText}
                                </h3>
                            )}

                            <div className={styles.popupBody}>
                                {children}
                            </div>

                            {ctaButtonText && (
                                <div className={styles.popupFooter}>
                                    <Button
                                        onClickAction={ctaButtonFunction}
                                        text={ctaButtonText}
                                        type="primary"
                                        stretched={true}
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