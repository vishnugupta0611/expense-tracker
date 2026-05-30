import Banner from "@/components/Banner";
import Messages from "@/components/Messages";
import Post from "@/components/Post";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex p-2 items-center flex-col h-[100%] bg-zinc-50 font-sans dark:bg-black">
           
              
    <Banner></Banner>
    <Messages />
   <Post/> 

    </div>
  );
}
