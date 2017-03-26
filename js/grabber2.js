$(document).ready(function(){
	var post_to_group_id = false;
	var schedule = false;
	var last_scheduled = false;
	var cnt_schd = -1;
	var posts;
	var current_post;
	var post_data;
	var donor_post;
	var donor_group;
	var post_on;
	var state = 0;
	var VERSION = "ver. 0.3.5";
	var min_sec = 3;
	var max_sec = 7;

	var randomInteger = function(min, max) {
    	var rand = min - 0.5 + Math.random() * (max - min + 1)
    	rand = Math.round(rand);
    	return rand;
  	}
	var eventFire = function (el, etype){
		if (el.fireEvent) {
			el.fireEvent('on' + etype);
		} 
		else{
			var evObj = document.createEvent('Events');
			evObj.initEvent(etype, true, false);
			el.dispatchEvent(evObj);
		}
	};
	var urldecode = function(url){

		return decodeURIComponent(url.replace(/\+/g, ' '));
	};
	var postTopicDone = function(data){
		current_post++;
		uiUpdate();
		if (current_post < posts.length && state == 1) {
			setTimeout(function(){ forEachPost(); }, randomInteger(min_sec, max_sec)*1000);
		}
		else{
			state = 0;
			uiDefreeze();
		}
		console.log(data);
	};
	var scheduleNext = function(){
		cnt_schd++;
		if (cnt_schd >= schedule.calendar.length) 
		{
			cnt_schd = 0;
			last_scheduled.setDate(last_scheduled.getDate()+1);
		}
		last_scheduled.setHours(schedule.calendar[cnt_schd][0]);
		last_scheduled.setMinutes(schedule.calendar[cnt_schd][1]);
	};
	var getTopicDone = function(data){
		data = JSON.parse(data);
		var posting = {
			Global_idGroup: "-" + post_to_group_id,
			Global_groupType: "group",
			Global_postId: donor_post,
			Version: "4.9.6",
			publish_date: post_on,
			Global_arrayAttachmentsOrig:[],
			Global_fromGroup: true,
			Global_markAsAds:0,
			Global_point:null,
			Global_source:"extension",
			social_from:"ok",
			social_to:"ok",
			idGroupFrom:donor_group,
			Global_checkWmrk:false,
			logtype:"fetch_ok",
			group_list: null
		};
		$(data.media_topics[0].media).each(function(index, media){
			if (media.type == "text")
			{
				posting.Global_arrayAttachmentsOrig.push([null, null, null, "text", null, null, media.text]);
			}
			else if (media.type == "photo")
			{
				for (j=0; j< media.photo_refs.length; j++)
				{
					for (i = 0; i < data.entities.group_photos.length; i++)
					{
						if (data.entities.group_photos[i].ref == media.photo_refs[j])
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
			}
		});
		console.log(data);
		console.log(posting);
		$.ajax({
			method: "POST",
			url: "/autoposting/add.php",
			data: posting,
		}).done(postTopicDone);
	};
	var forEachPost = function(){
		post_data = $(posts[current_post]).children("div.post-data")[0];
		donor_post = $(post_data).attr("data-post_id");
		donor_group = $(post_data).attr("data-owner_id");
		scheduleNext();
		post_on = Math.round(last_scheduled.getTime()/1000);
		console.log("found post id = ", donor_post);
		$.ajax({
			method: "POST",
			url: "/api/ok.php?method=mediatopic.getByIds",
			data: { 
				topic_ids: donor_post, 
				fields: "feed.*,media_topic.*,group_photo.*,video.*,music_track.*,poll.*,place.*,group.*,user.*"
			},
		}).done( function(data){ setTimeout(function(){ getTopicDone(data); }, randomInteger(min_sec, max_sec)*1000); });
	};
	var getScheduleDone = function(data){
		schedule = JSON.parse(data);
		console.log(schedule);
		last_scheduled = new Date();
		if (schedule.autoposting[0].date_list.length > 0)
		{
			last_scheduled = new Date(1000 * Math.max.apply(Math, schedule.autoposting[0].date_list));
			//last_scheduled = new Date(1000 * schedule.autoposting[0].date_list[schedule.autoposting[0].date_list.length - 1]);
		}
		for(i = 0; i < schedule.calendar.length; i++)
		{
			if (last_scheduled.getHours() == schedule.calendar[i][0] && last_scheduled.getMinutes() == schedule.calendar[i][1])
			{
				cnt_schd = i;
				break;
			}
		}
		if (cnt_schd < 0)
		{
			cnt_schd = 0;
			last_scheduled.setDate(last_scheduled.getDate()+1);
		}
		console.log(last_scheduled);
		console.log(cnt_schd);
		posts = $("div#scan_result").children("div.panel-post");//.each(forEachPost);
		current_post = 0;
		uiUpdate();
		forEachPost();
	};
	var getSchedule = function(){
		$.ajax({
			method: "POST",
			url: "/popup/getpostponed.php?owner_id="+post_to_group_id+"&owner_type=group&social=ok",
			data: "group_list=",
		}).done(getScheduleDone);
	};
	var uiUpdate = function(){
		$("span#grabb_info").text("Выполнено " + current_post + " из " + posts.length);
	};
	var uiFreeze = function(){
		$("span#grabb_info").css("display", "inline-block").text("Запуск...");
		$("button#grabbstop").css("display", "inline-block").prop("disabled", false);
		$("button#grabb").prop("disabled", true);
		$("select#post_to_select").prop("disabled", true);
	};
	var uiDefreeze = function(){
		$("span#grabb_info").css("display", "none");
		$("button#grabbstop").css("display", "none").prop("disabled", true);
		$("button#grabb").prop("disabled", false);
		$("select#post_to_select").prop("disabled", false);
	};
	var onGrabbClick = function(){
		if (state == 0){
			state = 1;
			uiFreeze();
			console.log("click!");
			//post_to_group_id = $("input#post_to").val();
			post_to_group_id = $("select#post_to_select").val();
			if (post_to_group_id.length > 0) getSchedule();
		}
		return false;
	};
	var onGrabbStop  = function(){
		if (state == 1){
			state = 0;
			$("button#grabbstop").text("Остановка, подождите").prop("disabled", true);
		}
		return false;
	};
	var initPanel = function(){
		var panel = $("<div/>");
		var input = $("<input>");
		var button = $("<button/>");
		var button2 = $("<button/>");
		var select = $("<select/>");
		var span = $("<span/>");
		var span2 = $("<span/>");
		var span3 = $("<span/>");

		button
			.attr("id", "grabb")
			.attr("href", "#")
			.addClass("btn")
	    	.css("margin-bottom", "10px")
			.text("Запланировать посты")
			.click(onGrabbClick);

		button2
			.attr("id", "grabbstop")
			.attr("href", "#")
			.addClass("btn btn-danger")
			.text("Остановить")
	    	.css("display", "none")
			.click(onGrabbStop);

		span
	    	.css("margin-bottom", "10px")
	    	.css("font-weight", "800")
	    	.text("Выберите группу");

		span2
			.attr("id", "grabb_info")
	    	.css("display", "none")
	    	.text("Выполнено: ");

		span3
	    	.css("color", "darkgray")
	    	.css("font-size", "1rem")
	    	.text(VERSION);

		input
			.attr("id", "post_to")
			.attr("type", "text")
			.addClass("input input-sm")
	    	.css("margin-bottom", "10px")
			.attr("placeholder", "ID группы");

		select
			.attr("id", "post_to_select")
	    	.css("margin-bottom", "10px")
			.addClass("input select2");

		panel
			.css("position", "fixed")
	    	.css("top", "20px")
	    	.css("right", "20px")
	    	.css("background-color", "white")
	    	.css("display", "flex")
	    	.css("flex-direction", "column")
	    	.css("padding", "15px")
			.css("border-radius", "5px")
			.css("box-shadow", "0 0 10px darkgrey")
	    	//.append(input)
	    	.append(span)
	    	.append(select)
	    	.append(button)
	    	.append(button2)
	    	.append(span2)
	    	.append(span3);

	    $.ajax({
	    	method:"get",
	    	url: "/popup/islogin.php?browser=chrome&formatResult=new2&version=4.9.6"
	    }).done(function(data){
	    	data = JSON.parse(data);
	    	for(var index in data.social_data.ok.groups) { 
	    		select.append("<option value=\""+index+"\">"+data.social_data.ok.groups[index].name+"</option>");
			}
	    });
		return panel;
	};

	$("body").append(initPanel());
});
