'use client';
import { useEffect, useRef } from "react";
import styles from '../styles/Modal.module.css';
import Button from "./Button";
import { X } from 'lucide-react';

/**
 * @param {*} props
 * @returns
 */
export default function Modal(props) {
    const { showModal, headerText, children, ctaButtonText, ctaButtonFunction, onClose } = props;
    const modalRef = useRef(null);

    const closeModal = () => {
        if (onClose) onClose();
    };

    const handleClickOutside = (event) => {
        event.stopPropagation();
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            closeModal();
        }
    };
    const handleEscape = (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    };
    useEffect(() => {
        if (showModal) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showModal]);


    return (
        <>
            {showModal && (
                <>
                    <div className={styles.modal}
                        style={{ display: showModal ? 'inline-block' : 'none' }}
                        aria-modal="true"
                        aria-hidden={!showModal}
                    >
                        <div className={`${styles.modalDialog} ${styles.modalDialogCentered}`} role="dialog" aria-labelledby="modalTitle" ref={modalRef}>
                            <div className={styles.modalContent}>
                                <div className={styles.modalHeader}>

                                    <div className={styles.modalClose}>
                                        <X
                                            fill="#fff"
                                            onClick={() => closeModal()}
                                        />
                                    </div>

                                    {headerText && (
                                        <h3 className={styles.h3}
                                            id="modalTitle">
                                            {headerText}
                                        </h3>
                                    )}
                                </div>

                                <div className={styles.modalBody}>
                                    {children}
                                </div>

                                {ctaButtonText && (
                                    <div className={styles.modalFooter}>
                                        <Button
                                            onClick={ctaButtonFunction}
                                            type="primary"
                                            stretched={true}
                                        >{ctaButtonText}</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
