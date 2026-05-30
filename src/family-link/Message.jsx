"use client"

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function MessagesPage() {

const initial=[

{
id:1,
author:"Asha Sharma",
text:"Dinner at 8, bring dessert 🍰",
time:"2h"
},

{
id:2,
author:"Rohit Gupta",
text:"Booked weekend tickets 🎟️",
time:"4h"
},

{
id:3,
author:"Sita Devi",
text:"Uploaded old family photos ❤️",
time:"1d"
}

]

const [messages,setMessages]=useState(initial)
const [value,setValue]=useState("")

const listRef=useRef(null)

useEffect(()=>{

listRef.current?.scrollTo({

top:listRef.current.scrollHeight

})

},[messages])


function send(){

if(!value.trim()) return

setMessages(prev=>([

...prev,

{

id:Date.now(),
author:"You",
text:value,
time:"now"

}

]))

setValue("")

}

return(

<div className="bg-black text-white min-h-screen">

<div className="max-w-[550px] mx-auto">

{/* top */}

<div className="sticky top-0 bg-black z-10 px-4 py-4">

<div className="flex items-center justify-between">

<div>

<h1 className="text-lg font-semibold">
Family Chat
</h1>

<p className="text-xs text-gray-500">
8 members online
</p>

</div>

<Link
href="/"
className="text-sm text-gray-400"
>

Back

</Link>

</div>

</div>


{/* messages */}

<div
ref={listRef}
className="px-4 pb-28"
>

{

messages.map(msg=>(

<div
key={msg.id}
className={`mb-5 flex ${
msg.author==="You"
?
"justify-end"
:
"justify-start"
}`}

>

{

msg.author!=="You" && (

<Image
unoptimized
src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${msg.author}`}
width={35}
height={35}
alt=""
className="rounded-full mr-2 self-end"
/>

)

}

<div>

{

msg.author!=="You" && (

<p className="text-xs text-gray-500 mb-1">

{msg.author}

</p>

)

}

<div

className={`

px-4
py-2
rounded-3xl
max-w-[250px]
text-sm

${
msg.author==="You"
?

"bg-white text-black"

:

"bg-zinc-900"
}

`}

>

{msg.text}

</div>

<p className="text-[10px] text-gray-600 mt-1">

{msg.time}

</p>

</div>

</div>

))

}

</div>


{/* input */}

<div
className="fixed bottom-0 left-0 w-full bg-black px-3 py-3"
>

<div
className="max-w-[550px] mx-auto flex gap-2"
>

<input

value={value}

onChange={(e)=>{

setValue(e.target.value)

}}

onKeyDown={(e)=>{

if(e.key==="Enter"){

send()

}

}}

placeholder="Message family..."

className="

flex-1
bg-zinc-900
rounded-full
px-4
py-3
outline-none
text-sm

"

/>

<button

onClick={send}

className="

bg-white
text-black
rounded-full
px-5

"

>

➜

</button>

</div>

</div>

</div>

</div>

)

}