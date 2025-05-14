import { useState } from "react";
import styles from '../styles/Header.module.css';
import globalConst from "@/constants";
import {Minus, Plus} from "lucide-react";

export default function Accordion() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = (title) => {
        setIsOpen({
            ...isOpen,
            [title]: !isOpen[title],
        });
    };

    const items = () => {
        return (
            Object.keys(globalConst.faqContent).map((key) =>
                <li key={key} className={styles.list_no_bullets}>
                    <div className={styles.accordion_grid}>
                        <button className={styles.clickable_title} onClick={() => toggleOpen(key)}>
                            <h3 >{ globalConst.faqContent[key].title }</h3>
                        </button>
                        <label htmlFor={`${key}`} className={styles.accordion_label}>
                            { isOpen[key] ?
                                <Minus size={24} /> : <Plus size={24} />
                            }
                        </label>
                    </div>
                    <div>
                        <input
                            id={`${key}`}
                            type="checkbox"
                            checked={isOpen}
                            onClick={() => toggleOpen(key)}
                            className="op__display_none_small"
                            readOnly={true}
                        />
                        { isOpen[key] &&
                            <p className="op__margin_1_top_bottom">{ globalConst.faqContent[key].text }</p>
                        }
                    </div>
                    <hr className="op__margin_standard_top_bottom"/>
                </li>
            )
        );
    };

    return (
        <div>
            { items() }
        </div>
    );
};
