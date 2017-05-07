'use strict';

var TEMPLATE = `
<div id="smbht">
	<div id="grabb_panel">
		<div class="label"></div>
		<div class="panel loading">
			<div class="splash"></div>
			<div class="processing">
				<div class="log"></div>
				<div class="count"></div>
				<div class="buttons">
					<button class="stop">Остановить</button>
				</div>
			</div>
			<div class="source-list">
				<div class="header">Забрать контент из групп</div>
				<ul></ul>
			</div>
			<div class="destination-list">
				<div class="header">Распределить контент по группам</div>
				<ul></ul>
			</div>
			<div class="settings"></div>
			<div class="info"></div>
			<div class="buttons">
				<button class="start">Запланировать</button>
			</div>
		</div>
	</div>
</div>
`;

//-----------------------------------

function randomInteger(min, max) { 
	var r = Math.round(min - 0.5 + Math.random() * (max - min + 1)); 
	return r;
}

//-----------------------------------

function beginLoad(){
	$.ajax({ url: `https://smmbox.com/findcontent/showmygroups.php?list=${grabb.list_id}&_=${(new Date()).getTime()}` }).done(listLoaded);
}
function listLoaded(data){
	data = JSON.parse(data);
	if (data.result == "ok"){
		var gs = "";
		$.each(data.groups.ok, (key, value) => { if (value.type == "group") gs += value.id + ","; });
		$.ajax({
			method: "post",
			url: "https://smmbox.com/api/ok.php?method=group.getInfo",
			data: { uids: gs.slice(0, -1), fields: "uid,name,members_count,pic_avatar,private" }
		}).done(groupsLoaded);
	}
}
function groupsLoaded(data){
	grabb["theirgroups"] = {};
	data = JSON.parse(data);
	$.each(data, (key, value) => { grabb.theirgroups[value.uid] = { id: value.uid, name: value.name }; });
	$.ajax({ url: "/popup/islogin.php?browser=chrome&formatResult=new2&version=4.9.6" }).done(loadDestination);
}
function loadDestination(data){
	grabb["mygroups"] = {};
	data = JSON.parse(data);
	if (data.error == "no") {
		$.each(data.social_data.ok.groups, (key, value) => { grabb.mygroups[key] = { id: key, name: value.name }; });
		updatePanel(grabb);
	}
}
function updatePanel()
{
    $.each(grabb.theirgroups, (key, value) => {
        var li = $(`<li class="checked" data-value="${key}">${value.name}</li>`).click(itemClick);
        $("div#smbht>div#grabb_panel>div.panel>div.source-list>ul").append(li);
    });
    $.each(grabb.mygroups, (key, value) => {
        var li = $(`<li data-value="${key}">${value.name}</li>`).click(itemClick);
        $("div#smbht>div#grabb_panel>div.panel>div.destination-list>ul").append(li);
    });
    endLoad();
}
function endLoad(){ $("div#smbht>div#grabb_panel>div.panel").toggleClass("loading"); }

//-----------------------------------

function pickProp(obj){ var result; var count = 0; for (var prop in obj) { if (Math.random() < 1/++count) { result = prop; } } return result; }

function loadStream(gid)
{
    console.log(`загружаем стрим для группы ${gid}...`);
	$.ajax({
		url: 'https://smmbox.com/api/ok.php?method=stream.get',
		method: 'post',
		data: {
			gid: gid,
			patterns: "POST,CONTENT,PHOTO",
			count: "60",
			fields: "feed.*,media_topic.*,group_photo.*,video.*,music_track.*,poll.*,place.*,group.*,user.*",
			anchor: grabb.source[gid].anchor,
		}
	}).done((data) => {
		data = JSON.parse(data);
		$.each(data.entities.media_topics, (key, value) => { grabb.source[gid].posts.push(value.id); });
		grabb.source[gid].anchor = data.anchor;
		selectPost(gid);
	});
}
function loadCalendar(dgid, gid, pid){
    console.log(`загружаем расписание для группы ${dgid}...`);
	$.ajax({
		method: "POST",
		url: `https://smmbox.com/popup/getpostponed.php?owner_id=${dgid}&owner_type=group&social=ok`,
		data: "group_list=",
	}).done((data) => {
		data = JSON.parse(data);
		if (data.calendar.length > 0) grabb.destination[dgid].calendar = { plan: data.calendar, used_dates: data.autoposting[0].date_list, free_dates: [] };
		else grabb.destination[dgid].calendar = "none";
		selectTime(dgid, gid, pid);
	});
}
function sendTopic(dgid, gid, pid, d, data){
	console.log(`размещаем пост...`);
	var posting = {
		Global_idGroup: "-" + dgid,
		Global_groupType: "group",
		Global_postId: pid,
		Version: "4.9.6",
		publish_date: d,
		Global_arrayAttachmentsOrig:[],
		Global_fromGroup: true,
		Global_markAsAds:0,
		Global_point:null,
		Global_source:"extension",
		social_from:"ok",
		social_to:"ok",
		idGroupFrom:gid,
		Global_checkWmrk:false,
		logtype:"fetch_ok",
		group_list: null
	};
	if (("media_topics" in data) && (data.media_topics.length > 0) && ("media" in data.media_topics[0]))
	{
		$(data.media_topics[0].media).each((key, value) => {
			if (value.type == "text")
			{
				if (value.text.search(/http/i) >= 0)
				{
					posting = null;
					return false;
				}
				else
				{
					posting.Global_arrayAttachmentsOrig.push([null, null, null, "text", null, null, value.text]);
				}
			}
			else if (value.type == "photo")
			{
				for (var j = 0; j < value.photo_refs.length; j++)
				{
					if("group_photos" in data.entities) {
						//data.entities.group_photos may be 'undefined'
						for (var i = 0; i < data.entities.group_photos.length; i++)
						{
							if (data.entities.group_photos[i].ref == value.photo_refs[j])
							{
								var big = null;
								var small = null;
								small = data.entities.group_photos[i].pic128x128;
								if ("picgif" in data.entities.group_photos[i])
								{
									big = data.entities.group_photos[i].picgif;
								}
								else
								{
									big = data.entities.group_photos[i].pic_max;								
								}
								var size = data.entities.group_photos[i].standard_width+"x"+data.entities.group_photos[i].standard_height;
								var ref = data.entities.group_photos[i].ref;
								posting.Global_arrayAttachmentsOrig.push([ref, null, big, "photo", 0, small, size, big]);
								break;
							}
						}
					}
					else{
						posting = null;
						return false;
					}
				}
			}
		});
	}
	else posting = null;

	if (posting == null) setTimeout(() => { selectSourceGroup(); }, randomInteger(grabb.delay.min, grabb.delay.max));
	else 
		$.ajax({
			method: "POST",
			url: "https://smmbox.com/autoposting/add.php",
			data: posting,
		}).done((data) => {
			console.log(`пост размещен...`);
			grabb.done_topics++;
			updateLog();
			if (grabb.state == "works") setTimeout(() => { selectSourceGroup(); }, randomInteger(grabb.delay.min, grabb.delay.max));
			else unlockLayout();
		});
}
function loadTopic(dgid, gid, pid, d){
	console.log(`загружаем данные поста #${pid}...`);
	$.ajax({
		method: "POST",
		url: "https://smmbox.com/api/ok.php?method=mediatopic.getByIds",
		data: { 
			topic_ids: pid, 
			fields: "feed.*,media_topic.*,group_photo.*,video.*,music_track.*,poll.*,place.*,group.*,user.*"
		},
	}).done((data) => {
		data = JSON.parse(data);
		console.log(`загружено`);
		setTimeout(() => { sendTopic(dgid, gid, pid, d, data); }, randomInteger(grabb.delay.min, grabb.delay.max));
	});
}
function planPost(dgid, gid, pid, d){
	console.log(`планируем пост #${pid} из группы #${gid} в группу #${dgid} на ${new Date(d*1000)}`);
	loadTopic(dgid, gid, pid, d);
	//setTimeout(() => { selectSourceGroup(); }, randomInteger(grabb.delay.min, grabb.delay.max));
}
function selectTime(dgid, gid, pid){
    console.log(`выбираем время для планирования...`);
	if (grabb.destination[dgid].calendar == null) {
    	console.log(`расписание не загружено...`);
		loadCalendar(dgid, gid, pid);
	}
	else if (grabb.destination[dgid].calendar == "none") {
    	console.log(`для группы ${dgid} не создано расписание, планирование для группы невозможно, удаляем группу из списка`);
		selectDestinationGroup(gid, pid);
	}
	else
	{
    	console.log(`расписание загружено...`);
		if (grabb.destination[dgid].calendar.free_dates.length == 0)
		{
			var date = new Date();
			var now = new Date();
			date.setHours(0,0,0,0);

    		console.log(`собираем список свободных дат для планирования...`);
			while(grabb.destination[dgid].calendar.free_dates.length < 100)
			{
				$.each(grabb.destination[dgid].calendar.plan, (key, value) => {
					date.setHours(value[0], value[1]);
					var secs = Math.round(date.getTime()/1000);
					if ((grabb.destination[dgid].calendar.used_dates.indexOf(secs)) < 0 && (date > now)){
						grabb.destination[dgid].calendar.free_dates.push(secs);
					}
				});
				date.setDate(date.getDate()+1);
			}
		}
		var dind = pickProp(grabb.destination[dgid].calendar.free_dates);
		var d = grabb.destination[dgid].calendar.free_dates[dind];
		grabb.destination[dgid].calendar.used_dates.push(d);
		grabb.destination[dgid].calendar.free_dates.splice(dind, 1);
		planPost(dgid, gid, pid, d);
	}
}
function selectDestinationGroup(gid, pid){
	var dgid = pickProp(grabb.destination);
    console.log(`выбираем группу-получатель для планирования... ${dgid}`);
	selectTime(dgid, gid, pid);
}
function selectPost(gid){
	var pind = pickProp(grabb.source[gid].posts);
	var pid = grabb.source[gid].posts[pind];
    console.log(`выбираем пост для копирования... ${pid}`);
	grabb.source[gid].posts.splice(pind, 1);
	selectDestinationGroup(gid, pid);
}
function selectSourceGroup(){
	var gid = pickProp(grabb.source);
    console.log(`выбираем группу-источник постов... ${gid}`);
	if (grabb.source[gid].posts.length > 0){
    	console.log(`посты загружены`);
		selectPost(gid);
	}
	else{
    	console.log(`посты не загружены`);
		loadStream(gid);
	}
}
function beginPosting(){
    console.log(`начинаем постинг...`);
	lockLayout();
	grabb.source = {};
	var have_sources = 0;
    $("div#smbht>div#grabb_panel>div.panel>div.source-list>ul>li").each((key, value) => {
        var gid = $(value).attr("data-value");
        if ($(value).hasClass("checked") && gid.length > 0) {
        	grabb.source[gid] = { anchor: null, posts: [] };
        	have_sources++;
        }
    });
	grabb.destination = {};
	var have_destinations = 0;
    $("div#smbht>div#grabb_panel>div.panel>div.destination-list>ul>li").each((key, value) => {
        var gid = $(value).attr("data-value");
        if ($(value).hasClass("checked") && gid.length > 0) {
        	grabb.destination[gid] = { calendar: null };
        	have_destinations++;
        }
    });
    if (have_destinations > 0 && have_sources > 0) selectSourceGroup();
}
function lockLayout(){
	$("div#smbht>div#grabb_panel>div.panel").addClass("works");
}
function unlockLayout(){
	$("div#smbht>div#grabb_panel>div.panel>div.processing").removeClass("stopping");
	$("div#smbht>div#grabb_panel>div.panel").removeClass("works");
	grabb.state = "stop";
}
function updateLog(){
	$("div#smbht>div#grabb_panel>div.panel>div.processing>div.count").text(`Запланировано постов: ${grabb.done_topics}`);
}

//-----------------------------------

function itemClick(){ $(this).toggleClass("checked"); }
function panelTogglerClick(){
	if ($("div#smbht>div#grabb_panel>div.panel").hasClass("loading")) beginLoad();
	$("div#smbht").toggleClass("opened");		
}
function startButtonClick(){
	grabb["delay"] = { min: 3000, max: 7000 };
	grabb["log"] = {};
	grabb["done_topics"] = 0;
	grabb.state = "works";
	beginPosting();
}
function stopButtonClick(){
	grabb.state = "stopping";
	$("div#smbht>div#grabb_panel>div.panel>div.processing").addClass("stopping");
}

//-----------------------------------

var grabb = {};

$(document).ready(() => {
	grabb = { list_id: location.search.replace(/^.*?list\=/, ''), state: "stop" };
	if (grabb.list_id.length > 0){
		$("body").append(TEMPLATE);
		$("div#smbht>div#grabb_panel>div.label").click(panelTogglerClick);
		$("div#smbht>div#grabb_panel>div.panel>div.buttons>button.start").click(startButtonClick);
		$("div#smbht>div#grabb_panel>div.panel>div.processing>div.buttons>button.stop").click(stopButtonClick);
	}
});
