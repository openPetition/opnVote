'use client';
import React from "react";
import styles from './../styles/Loading.module.css';

export default function Loading(props) {
  const { loadingText } = props;

  return (
    <>
      <div className={styles.loadingbox}>
        <div className={styles.loader}></div>
        <h4>{loadingText}</h4>
      </div>
    </>
  )
}