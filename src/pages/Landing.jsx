import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import PhotoStrip from '../components/public/PhotoStrip';
import Button from '../components/ui/Button';
import '../components/public/public.css';

/* Built to the Figma "Home" frame: header, photo hero, cream statement band,
   photo strip, footer. The strip uses our own local photography rather than
   the frame's placeholder stock images — see PhotoStrip.

   Signup goes to the invitation-gated registration form. Accounts here are
   issued by the district office rather than self-serve, so that screen asks
   for the code first and shows which role it grants. */
export default function Landing() {
  return (
    <div className="public">
      <PublicHeader />

      <section className="hero">
        <div
          className="hero__photo"
          style={{ backgroundImage: 'url(/photos/hero.jpg)' }}
          aria-hidden="true"
        />
        <div className="hero__wash" aria-hidden="true" />

        <div className="hero__inner">
          <h1 className="hero__title">
            From Land to Lives &ndash;
            <br />
            Managing Every Step With Transparency.
          </h1>
          <p className="hero__body">
            Designed to bring transparency and efficiency to land acquisition, our
            platform helps officials navigate every stage of the process while
            ensuring that affected families, landowners, and their rights remain at
            the centre of every case.
          </p>
          <div className="hero__actions">
            <Button to="/login" variant="primary" size="public">
              Login
            </Button>
            <Button to="/signup" variant="secondary" size="public">
              Signup
            </Button>
          </div>
        </div>
      </section>

      <section className="statement">
        <h2 className="statement__title">
          Making Every Acquisition Count.
          <br />
          Making Every Decision Matter.
        </h2>
        <p className="statement__body">
          Every parcel represents a family, a livelihood, and a future &mdash; we bring
          clarity, transparency, and fairness to every step of the journey.
        </p>
        <div className="statement__actions">
          <Button to="/notices" variant="primary" size="public-lg">
            Notices
          </Button>
          <Button to="/notices" variant="secondary" size="public-lg">
            Case Studies
          </Button>
        </div>
      </section>

      <PhotoStrip />

      <PublicFooter />
    </div>
  );
}
