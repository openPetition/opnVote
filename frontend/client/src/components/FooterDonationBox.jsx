'use client';

import styles from '../styles/FooterDonationBox.module.css';
import Button from './Button';

export default function FooterDonationBox() {
	return (
		<>
			<div className={styles.box}>
				<div className={styles.blueheartbox}>
					<p className={styles.textblock}>
						Helfen Sie uns demokratische Online-Wahlen möglich zu machen. Um die Plattform kostenlos bereitzustellen, sind wir auf Spenden angewiesen.
					</p>
					<Button
						onClickAction={() => { window.location = 'https://openpetition.org/spenden'; }}
						type="dark"
						text="JETZT SPENDEN"
						style={{ display: 'block', margin: '0 auto', marginTop: '1.5rem', fontWeight: 'bold', padding: '10px 15px' }}
					/>
				</div>
			</div>
		</>
	);
}
