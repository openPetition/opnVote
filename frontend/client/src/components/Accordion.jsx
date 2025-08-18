import { useState } from "react";
import accordeon_styles from '../styles/Accordeon.module.css';
import { Minus, Plus } from "lucide-react";

export default function Accordion(props) {
    const { contents } = props;

    const Item = function ({ key, title, text }) {
        const [open, setOpen] = useState(false);

        return (

            <li key={key} className={accordeon_styles.list_no_bullets}>
                <div className={accordeon_styles.accordion_grid} onClick={() => setOpen(!open)}>
                    <button className={accordeon_styles.clickable_title}>
                        <h3>{title}</h3>
                    </button>
                    <div className={accordeon_styles.icon}>
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
        <div className={accordeon_styles.accordeon}>
            {items()}
        </div>
    );
};
