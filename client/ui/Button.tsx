import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import Icon, { type IconName } from './Icon.tsx'
import styles from './ui.module.css'

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'gold' | 'buy' | 'sell' | 'danger'

interface Look {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  icon?: IconName
  iconRight?: IconName
  children?: ReactNode
}

function classes(
  { variant = 'primary', size = 'md', block }: Look,
  iconOnly: boolean,
  extra?: string,
) {
  return [
    styles.button,
    styles[variant],
    size !== 'md' && styles[size],
    block && styles.block,
    iconOnly && styles.iconOnly,
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

function Content({ icon, iconRight, children, size }: Look) {
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 18
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  )
}

export default function Button({
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  className,
  type = 'button',
  ...props
}: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  const look = { variant, size, block, icon, iconRight, children }
  return (
    <button
      type={type}
      className={classes(look, !children, className)}
      {...props}
    >
      <Content {...look} />
    </button>
  )
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  className,
  ...props
}: Look & LinkProps) {
  const look = { variant, size, block, icon, iconRight, children }
  return (
    <Link className={classes(look, !children, className)} {...props}>
      <Content {...look} />
    </Link>
  )
}
