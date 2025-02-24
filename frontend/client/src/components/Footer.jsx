'use client';

import styles from '../styles/Footer.module.css';
import FooterDonationBox from './FooterDonationBox';
import NextImage from 'next/image';
import { useTranslation } from "next-i18next";

export default function Footer() {
	const { t } = useTranslation();

    return (
        <>

			<footer>
				<FooterDonationBox />
					<div className={styles.greyblock}>
						<div className={styles.greyblockcontent}>
							<div className={styles.checkmarks}>
								<span className={styles.checkmark}>{t('footer.checkmarks.secret')}</span>
								<span className={styles.checkmark}>{t('footer.checkmarks.verifiable')}</span>
								<span className={styles.checkmark}>{t('footer.checkmarks.decentralized')}</span>
							</div>
							<div className={styles.logo}>
									{t('footer.logo.text')}
									<NextImage
										alt="openpetition logo"
										src="/images/openpetition-logo.png"
										height={68}
										width={194}
										style={{ marginTop: ".5rem" }}
									/>
							</div>
						</div>
					</div>
					<div className={styles.textblock}>
						<div className={styles.textblockcontent}>
							<div className={styles.copyright}>
								<a href="https://creativecommons.org" rel="external nofollow">
									<NextImage
										src="/images/creative-commons.svg"
										height={20}
										width={20}
										alt="creative commons"
									/>
								</a>
								{new Date().getFullYear()}
								<a href="https://openpetition.net/" className={styles.link}>openPetition gGmbH</a>
							</div>

							<div className={styles.links}>
								<a href="#" className={styles.link}>{t('footer.links.dataprivacy')} | </a>
								<a href="#" className={styles.link}>{t('footer.links.impressum')} | </a>
								<a href="#" className={styles.link}>{t('footer.links.transparency')}</a>
							</div>

							<div className={styles.icons}>
								<a href="#" className={styles.icon}>
									<svg width="20px" height="20px" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 6 17">
										<path fillRule="evenodd" d="M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z" clipRule="evenodd" />
									</svg>
									<span className="sr-only">Facebook Seite</span>
								</a>
								<a href="#" className={styles.icon}>
									<svg width="20px" height="20px" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 1350 1100">
										<path fillRule="evenodd" d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" clipRule="evenodd" />
									</svg>

									<span className="sr-only">Twitter Seite</span>
								</a>
							</div>
						</div>
					</div>

            </footer>

        </>
    );
}
