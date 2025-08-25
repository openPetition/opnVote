import { useState } from "react";
import styles from '../styles/Accordeon.module.css';
import { Minus, Plus } from "lucide-react";

export default function Accordeon(props) {
    const { contents } = props;

    const Item = function ({ key, title, text }) {
        const [open, setOpen] = useState(false);

        return (
            <li key={key} className={styles.item}>
                <div className={styles.item_header} onClick={() => setOpen(!open)}>
                    <h3>{title}</h3>
                    <div className={styles.item_header_icon}>
                        {open ? <Minus size={24} /> : <Plus size={24} />}
                    </div>
                </div>
                <div>
                    {open && <p className="op__margin_1_top_bottom">{text}</p>}
                </div>
                <hr className="op__margin_standard_top_bottom" />
            </li>
        );
    };

    const items = () => Object.entries(contents).map(([key, item]) => <Item key={key} title={item.title} text={item.text} />);

    return (
        <div className={styles.accordeon}>
            {items()}
        </div>
    );
};
