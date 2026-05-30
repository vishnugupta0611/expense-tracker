

import { useState } from "react";

export default function Post() {
    const posts = [

{
id:1,
image:"https://images.pexels.com/photos/37643742/pexels-photo-37643742.jpeg",
likes:[
{userId:"user_101"},
{userId:"user_102"},
{userId:"user_103"},
{userId:"user_104"}
],
comments:[
{
id:"comment_1",
userId:"user_201",
text:"Wallpaper material 🔥",
createdAt:"2026-05-22T10:30:00Z"
},
{
id:"comment_2",
userId:"user_202",
text:"Insane shot 😮",
createdAt:"2026-05-22T11:00:00Z"
}
],
caption:"Late night city vibes 🌃",
userId:"user_001",
username:"vishnu_dev",
location:"Varanasi",
createdAt:"2026-05-22T08:00:00Z"
},

{
id:2,
image:"https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg",
likes:[
{userId:"user_105"},
{userId:"user_106"}
],
comments:[
{
id:"comment_3",
userId:"user_203",
text:"Nature never misses 🍃",
createdAt:"2026-05-22T12:00:00Z"
}
],
caption:"Nature feels unreal sometimes 🍃",
userId:"user_002",
username:"ayush_raw",
location:"Delhi",
createdAt:"2026-05-21T07:00:00Z"
},

{
id:3,
image:"https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg",
likes:[
{userId:"user_107"},
{userId:"user_108"},
{userId:"user_109"}
],
comments:[
{
id:"comment_4",
userId:"user_204",
text:"Coding setup goals 💻",
createdAt:"2026-05-21T09:00:00Z"
},
{
id:"comment_5",
userId:"user_205",
text:"Coffee + code combo ☕",
createdAt:"2026-05-21T09:30:00Z"
}
],
caption:"Morning coffee and code ☕",
userId:"user_003",
username:"gupta_codes",
location:"Kanpur",
createdAt:"2026-05-21T06:00:00Z"
},

{
id:4,
image:"https://images.pexels.com/photos/34950/pexels-photo.jpg",
likes:[
{userId:"user_110"}
],
comments:[
{
id:"comment_6",
userId:"user_206",
text:"Road trip needed asap 🚗",
createdAt:"2026-05-20T08:00:00Z"
}
],
caption:"Road trips hit different 🚗",
userId:"user_004",
username:"travel_x",
location:"Mumbai",
createdAt:"2026-05-20T06:00:00Z"
},

{
id:5,
image:"https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg",
likes:[
{userId:"user_111"},
{userId:"user_112"},
{userId:"user_113"},
{userId:"user_114"},
{userId:"user_115"}
],
comments:[
{
id:"comment_7",
userId:"user_207",
text:"Need this place location 😭",
createdAt:"2026-05-19T05:00:00Z"
},
{
id:"comment_8",
userId:"user_208",
text:"Beautiful click ✨",
createdAt:"2026-05-19T06:00:00Z"
}
],
caption:"Sunsets quietly winning again 🌅",
userId:"user_005",
username:"sky_hunter",
location:"Jaipur",
createdAt:"2026-05-19T03:00:00Z"
},

{
id:6,
image:"https://images.pexels.com/photos/210186/pexels-photo-210186.jpeg",
likes:[
{userId:"user_116"},
{userId:"user_117"}
],
comments:[
{
id:"comment_9",
userId:"user_209",
text:"That car looks sick 🏎️",
createdAt:"2026-05-18T11:00:00Z"
}
],
caption:"Weekend speed therapy 🏎️",
userId:"user_006",
username:"speed_king",
location:"Noida",
createdAt:"2026-05-18T08:00:00Z"
},

{
id:7,
image:"https://images.pexels.com/photos/257360/pexels-photo-257360.jpeg",
likes:[
{userId:"user_118"},
{userId:"user_119"},
{userId:"user_120"}
],
comments:[
{
id:"comment_10",
userId:"user_210",
text:"Doggo deserves verified badge 🐶",
createdAt:"2026-05-17T12:00:00Z"
}
],
caption:"CEO of cuteness 🐶",
userId:"user_007",
username:"pet_world",
location:"Lucknow",
createdAt:"2026-05-17T09:00:00Z"
},

{
id:8,
image:"https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg",
likes:[
{userId:"user_121"},
{userId:"user_122"},
{userId:"user_123"},
{userId:"user_124"}
],
comments:[
{
id:"comment_11",
userId:"user_211",
text:"Movie night unlocked 🍿",
createdAt:"2026-05-16T08:00:00Z"
},
{
id:"comment_12",
userId:"user_212",
text:"Bring snacks 😭",
createdAt:"2026-05-16T08:20:00Z"
}
],
caption:"Movie night setup complete 🍿",
userId:"user_008",
username:"night_vibes",
location:"Prayagraj",
createdAt:"2026-05-16T05:00:00Z"
},

{
id:9,
image:"https://images.pexels.com/photos/935985/pexels-photo-935985.jpeg",
likes:[
{userId:"user_125"},
{userId:"user_126"}
],
comments:[
{
id:"comment_13",
userId:"user_213",
text:"Everyone looks happy ❤️",
createdAt:"2026-05-15T09:00:00Z"
}
],
caption:"Cousins reunion after ages ❤️",
userId:"user_009",
username:"family_diary",
location:"Agra",
createdAt:"2026-05-15T07:00:00Z"
},



]
  const [commentData, setCommentData] = useState({});
  const [yourId] = useState("user_101");
  const [postData, setPostData] = useState(posts);
  const [activeCommentEdit, setActiveCommentEdit] = useState(null);

   

  function timeAgo(date) {
    const diff = Math.floor((new Date() - new Date(date)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  function toggleLike(postId) {
    setPostData((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const liked = p.likes.some((like) => like.userId === yourId);
        return {
          ...p,
          likes: liked
            ? p.likes.filter((like) => like.userId !== yourId)
            : [...p.likes, { userId: yourId }],
        };
      })
    );
  }

  function addComment(postId) {
    if (!commentData[postId]) return;
    setPostData((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [
            ...p.comments,
            {
              id: Date.now(),
              userId: yourId,
              text: commentData[postId],
              createdAt: new Date(),
            },
          ],
        };
      })
    );
    setCommentData((prev) => ({ ...prev, [postId]: "" }));
  }

  return (
    <div className="bg-black text-white w-full flex flex-col items-center px-1 py-4">
      {postData.map((post) => (
        <div key={post.id} className="w-full max-w-[500px] mb-10">

          {/* Profile */}
          <div className="flex items-center gap-3 mb-3">
            <img
              height={40}
              width={40}
              loading="eager"
              className="rounded-full"
              src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${post.username}`}
              alt=""
            />
            <div>
              <h3 className="text-sm">{post.username}</h3>
              <p className="text-xs text-gray-500">{timeAgo(post.createdAt)}</p>
            </div>
          </div>

          {/* Image */}
          <img
            src={post.image}
            alt=""
            loading="eager"
            fetchPriority="high"
            width={600}
            height={500}
            className="w-full h-[450px] rounded-[25px] object-cover"
          />

          {/* Actions */}
          <div className="flex gap-5 text-2xl py-4">
            <div className="cursor-pointer" onClick={() => toggleLike(post.id)}>
              {post.likes.some((like) => like.userId === yourId) ? "❤️" : "🤍"}
            </div>
            <div
              className="cursor-pointer"
              onClick={() =>
                setActiveCommentEdit((prev) =>
                  prev === post.id ? null : post.id
                )
              }
            >
              💬
            </div>
          </div>

          {/* Likes */}
          <div className="text-sm font-bold">{post.likes.length} likes</div>

          {/* Caption */}
          <div className="text-sm mt-2">
            <b>{post.username}</b> {post.caption}
          </div>

          {/* Comments */}
          {activeCommentEdit === post.id && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  value={commentData[post.id] || ""}
                  onChange={(e) =>
                    setCommentData((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                  placeholder="Add comment..."
                  className="flex-1 bg-[#111] border-none outline-none rounded-full px-4 h-[40px] text-sm"
                />
                <button
                  onClick={() => addComment(post.id)}
                  className="bg-[#222] px-4 rounded-full text-sm"
                >
                  Add
                </button>
              </div>

              <div className="mt-4">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 mb-3 text-sm">
                    <b>{comment.userId}</b>
                    <span className="text-gray-300">{comment.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ))}
    </div>
  );
}