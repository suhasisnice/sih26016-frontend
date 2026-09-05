import { Link } from 'react-router-dom';
import { Facebook, Linkedin, Twitter } from 'lucide-react';

/* The mauve footer closing every public page: tagline, three link columns,
   thin social icons. Nothing here is a real destination — a hackathon
   prototype's footer is the one place a placeholder is honest, since the
   product has no press page or careers page to link to. */
export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__top">
        <div className="public-footer__brand">
          <div className="public-footer__brand-row">
            <img src="/brand/logo.png" alt="" className="public-footer__mark" aria-hidden="true" />
            <span className="public-footer__word">BHOOMIMITRA</span>
          </div>
          <p className="public-footer__tagline">From land to lives.</p>
          <div className="public-footer__social">
            <a href="#" aria-label="Twitter"><Twitter size={16} strokeWidth={1.75} /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin size={16} strokeWidth={1.75} /></a>
            <a href="#" aria-label="Facebook"><Facebook size={16} strokeWidth={1.75} /></a>
          </div>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">Platform</p>
          <Link to="/">Home</Link>
          <Link to="/notices">Notices</Link>
          <Link to="/login">Login</Link>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">The Act</p>
          <Link to="/notices">Preliminary notifications</Link>
          <Link to="/notices">Declarations</Link>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">Ministry</p>
          <span>Department of Land Resources</span>
          <span>Ministry of Rural Development</span>
        </div>
      </div>

      <div className="public-footer__bottom">
        <span>&copy; {new Date().getFullYear()} Bhoomimitra. Built for Smart India Hackathon.</span>
      </div>
    </footer>
  );
}
