import { useState } from "react";
import styles from '../styles/Header.module.css';
import { Minus, Plus } from "lucide-react";

export default function Accordion(props) {
    const { contents } = props;

    const Item = function({key, title, text}) {
        const [open, setOpen] = useState(false);

        return (
            <li key={key} className={styles.list_no_bullets}>
                <div className={styles.accordion_grid}>
                    <button className={styles.clickable_title} onClick={() => setOpen(!open)}>
                        <h3>{title}</h3>
                    </button>
                    <label htmlFor={`${key}`} className={styles.accordion_label}>
                        {open ? <Minus size={24} /> : <Plus size={24} />}
                    </label>
                </div>
                <div>
                    <input
                        id={`${key}`}
                        type="checkbox"
                        checked={open}
                        onClick={() => setOpen(!open)}
                        className="op__display_none_small"
                        readOnly={true}
                    />
                    {open && <p className="op__margin_1_top_bottom">{text}</p>}
                </div>
                <hr className="op__margin_standard_top_bottom" />
            </li>
        );
    };

    const items = () => Object.entries(contents).map(([key, item]) => <Item key={key} title={item.title} text={item.text} />);

    return (
        <div>
            {items()}
        </div>
    );
};
