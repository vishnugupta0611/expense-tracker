import Banner from "../family-link/components/Banner.jsx";
import MessagesButton from "../family-link/components/Messages.jsx";
import './FamilyLinkPage.css';
import Post from "../family-link/components/Post.jsx";

const FamilyLinkPage = () => {
  return (
    <div className="family-link-page">
      <Banner />
      <MessagesButton />
      <Post />
    </div>
  );
};

export default FamilyLinkPage;
