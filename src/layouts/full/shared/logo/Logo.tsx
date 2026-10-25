
import { Link } from 'react-router-dom'
import LogoIcon from 'src/assets/images/logos/logoicon.svg'
import { SidebarMenuButton } from 'src/components/ui/sidebar'

const Logo = () => {
    return (
        <Link to={'/'}>


            <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-cem-elevated data-[state=open]:text-cem-text"
            >
                <img src={LogoIcon} alt="logo" />
            </SidebarMenuButton>
        </Link>
    )
}

export default Logo
