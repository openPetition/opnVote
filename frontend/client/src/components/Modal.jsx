'use client';
import { useEffect, useRef } from "react";
import styles from '../styles/Modal.module.css';
import Button from "./Button";
import { X } from 'lucide-react';
import { useTranslation } from 'next-i18next';

/**
 * @param {*} props
 * @returns
 */
export default function Modal(props) {
    const {
        showModal,
        headerText,
        children,
        ctaButtonText,
        ctaButtonFunction,
        ctaButtonType = 'primary',
        onClose,
        contentClassName,
    } = props;
    const { t } = useTranslation();
    const modalRef = useRef(null);
    const ctaButtonRef = useRef(null);
    const previouslyFocusedElementRef = useRef(null);

    const closeModal = () => {
        if (onClose) {
            onClose();
        };
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
            previouslyFocusedElementRef.current = document.activeElement;
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            const initialFocusElement = ctaButtonRef.current
                || modalRef.current?.querySelector('[data-modal-body] button:not([disabled])');
            initialFocusElement?.focus();
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            if (showModal && previouslyFocusedElementRef.current?.isConnected) {
                previouslyFocusedElementRef.current.focus();
            }
        };
    }, [showModal]);


    return (
        <>
            {showModal && (
                <>
                    <div className={styles.modal}
                        style={{ display: showModal ? 'inline-block' : 'none' }}
                    >
                        <div
                            className={`${styles.modalDialog} ${styles.modalDialogCentered}`}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="modalTitle"
                            ref={modalRef}
                        >
                            <div className={`${styles.modalContent} ${contentClassName || ''}`}>
                                <div className={styles.modalHeader}>

                                    <button
                                        type="button"
                                        className={styles.modalClose}
                                        onClick={closeModal}
                                        aria-label={t('common.close')}
                                    >
                                        <X
                                            fill="#fff"
                                            aria-hidden="true"
                                        />
                                    </button>

                                    {headerText && (
                                        <h3 className={styles.h3}
                                            id="modalTitle">
                                            {headerText}
                                        </h3>
                                    )}
                                </div>

                                <div className={styles.modalBody} data-modal-body>
                                    {children}
                                </div>

                                {ctaButtonText && (
                                    <div className={styles.modalFooter}>
                                        <Button
                                            ref={ctaButtonRef}
                                            onClick={ctaButtonFunction}
                                            type={ctaButtonType}
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
