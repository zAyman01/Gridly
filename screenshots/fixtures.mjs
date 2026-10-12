const date = '2026-10-12T09:00:00Z';
export const users = ['Nour Hassan', 'Omar Ali', 'Salma Ahmed', 'Karim Ibrahim'].map((name, i) => ({ _id: `user-${i+1}`, name, email: `teammate${i+1}@example.com`, role: i ? 'user' : 'admin', createdAt: date, updatedAt: date }));
export const workspaces = ['Acme Studio', 'Product Engineering', 'Design Collective'].map((name,i) => ({ _id: `workspace-${i+1}`, name, slug: ['acme-studio','product-engineering','design-collective'][i], owner: users[0], members: users.map(user=>({user, role: user === users[0] ? 'admin' : 'member'})), settings: {}, createdAt: date, updatedAt: date }));
export const boards = ['Q4 Product Roadmap', 'Website Launch', 'Design System'].map((title,i) => ({ _id:`board-${i+1}`, title, description:['From customer insight to polished release.','A focused launch plan for our new experience.','Shared foundations for consistent product design.'][i], workspace:workspaces[0], owner:users[0], members:users.map(user=>({user,role:user===users[0]?'owner':'editor',joinedAt:date})), visibility:'workspace', customFields:[{name:'Sprint',type:'select',options:['Sprint 1','Sprint 2','Sprint 3']},{name:'Estimate',type:'number'}], createdAt:date,updatedAt:date }));
export const lists = ['Backlog','In Progress','Review','Done'].map((title,i)=>({_id:`list-${i+1}`,title,board:'board-1',position:i,createdAt:date,updatedAt:date}));
export const tasks = ['Customer onboarding research','Design account settings','Build notification centre','Improve search performance','Launch team invitations','Accessibility review','Update API documentation','Mobile navigation polish','Release checklist','Analytics dashboard','Payment integration','Usability testing'].map((title,i)=>({
  _id:`task-${i+1}`,title,description:'Collaborate with the product team to deliver a clear, accessible experience.\n\n## Acceptance criteria\n- Confirm requirements with the design team\n- Implement and review the user flow\n- Verify accessibility and responsive layouts',
  list:lists[i%4]._id,board:'board-1',position:Math.floor(i/4),priority:['high','medium','urgent','low'][i%4],status:['todo','in_progress','in_progress','done'][i%4],assignees:[users[i%4]],dueDate:`2026-10-${String(13+i).padStart(2,'0')}T12:00:00Z`,tags:[['Research','UX','Engineering','Quality'][i%4],'Q4'],checklist:[{_id:`check-${i}-1`,text:'Confirm acceptance criteria',done:true,position:0},{_id:`check-${i}-2`,text:'Review implementation',done:false,position:1}],customFieldValues:{Sprint:'Sprint 1',Estimate:3+i%5},dependencies:i?[{task:'task-1',type:'blocked_by'}]:[],createdBy:users[0],createdAt:'2026-10-05T09:00:00Z',updatedAt:date,completedAt:i%4===3?date:undefined
}));
export const detail={board:boards[0],lists,tasksByList:Object.fromEntries(lists.map(list=>[list._id,tasks.filter(t=>t.list===list._id)]))};
export const analytics={totalTasks:12,completionRate:0.25,tasksByStatus:{todo:3,in_progress:6,done:3},tasksByPriority:{low:3,medium:3,high:3,urgent:3},tasksByAssignee:users.map(user=>({name:user.name,userId:user._id,count:3})),velocity:Array.from({length:14},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,count:1+i%4}))};
export function fixture(path){
  if(path==='/api/auth/me')return users[0];
  if(path==='/api/workspaces')return workspaces;
  if(path.startsWith('/api/workspaces/'))return {workspace:workspaces[0],boards,role:'admin'};
  if(path==='/api/boards')return boards;
  if(path.startsWith('/api/analytics/'))return analytics;
  if(path.endsWith('/comments'))return [{_id:'comment-1',task:'task-1',board:'board-1',author:users[1],body:'The research notes look great. I added the accessibility requirements to the brief.',mentions:[],createdAt:date,updatedAt:date}];
  if(path.endsWith('/attachments'))return [{_id:'attachment-1',task:'task-1',board:'board-1',uploader:users[0],filename:'onboarding-research.pdf',url:'https://example.com/research.pdf',mimeType:'application/pdf',sizeBytes:242688,publicId:'portfolio-file',createdAt:date}];
  if(path.endsWith('/activity'))return tasks.slice(0,5).map((task,i)=>({_id:`activity-${i}`,action:['task.created','task.moved','task.updated','comment.created','task.updated'][i],board:'board-1',task:task._id,user:users[i%4],details:{title:task.title,preview:'Ready for the team review.',fromList:'Backlog',toList:'In Progress'},createdAt:date}));
  if(path.startsWith('/api/users/search'))return users;
  if(path==='/api/boards/board-1')return detail;
  throw new Error(`Missing portfolio API fixture: ${path}`);
}
