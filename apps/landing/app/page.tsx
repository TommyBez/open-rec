import { capabilityCards, downloads, releaseSignals } from "@/lib/downloads";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>OpenRec / desktop recorder</p>
          <h1>Capture the proof. Edit the mess. Ship the file.</h1>
          <p className={styles.lead}>
            OpenRec is a desktop recorder and timeline editor for people who need a reliable
            screen capture workflow, not another disposable recording tab.
          </p>

          <div className={styles.ctaRow}>
            <a className={styles.primaryCta} href="#downloads">
              Download preview builds
            </a>
            <a
              className={styles.secondaryCta}
              href="https://github.com/TommyBez/open-rec"
              target="_blank"
              rel="noreferrer"
            >
              View source on GitHub
            </a>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.signalHeader}>
            <span>Release signal</span>
            <span>CI-backed</span>
          </div>
          <ul className={styles.signalList}>
            {releaseSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          <p className={styles.panelNote}>
            macOS builds are intentionally unsigned previews. The page links the latest release
            assets so downloads stay current without updating the landing page by hand.
          </p>
        </div>
      </section>

      <section className={styles.capabilities}>
        {capabilityCards.map((card, index) => (
          <article key={card.title} className={styles.capabilityCard}>
            <span className={styles.capabilityIndex}>0{index + 1}</span>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section id="downloads" className={styles.downloadSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Artifacts</p>
          <h2>Download the latest release builds.</h2>
          <p className={styles.sectionSummary}>
            Every link points to the latest GitHub release asset. Checksums are published
            alongside each binary so teams can verify what CI produced.
          </p>
        </div>

        <div className={styles.downloadGrid}>
          {downloads.map((download) => (
            <article key={`${download.platform}-${download.artifact}`} className={styles.downloadCard}>
              <div className={styles.downloadTopline}>
                <span>{download.platform}</span>
                <span>{download.artifact}</span>
              </div>
              <p>{download.note}</p>
              <div className={styles.downloadActions}>
                <a href={download.href}>Download</a>
                <a href={download.checksumHref}>SHA256</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.footerBand}>
        <div>
          <p className={styles.eyebrow}>Install notes</p>
          <p className={styles.installNote}>
            On macOS, open the unsigned app from Finder with a right click and confirm the
            security dialog. On Linux, ensure `ffmpeg` is on `PATH` before recording.
          </p>
        </div>
        <a
          className={styles.docLink}
          href="https://github.com/TommyBez/open-rec/blob/main/docs/UNSIGNED_MAC_INSTALL.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the install guide
        </a>
      </section>
    </main>
  );
}
