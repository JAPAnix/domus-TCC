import { cardClass } from './styles';

export default function Card({ as: Tag = 'div', padded = true, className = '', children, ...props }) {
  return <Tag className={`${cardClass} ${padded ? 'p-5 sm:p-6' : ''} ${className}`.trim()} {...props}>{children}</Tag>;
}
