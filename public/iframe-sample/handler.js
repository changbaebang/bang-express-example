

let addLazyClick = (ele) => {
  let target = ele;
  let isMoved = false;
  let timerInterval = 200;
  let triggingEventName = "click";
  let mediateEventName = "lazy-click";

  (() => {
    // warn to infinite loop
    while(ele["on"+mediateEventName] === "function") {
      mediateEventName = "-" + mediateEventName;
    }
    console.info("custom event name is " + mediateEventName);
  })();

  let eventDispatcher = (targetElement, eventName) => {
    console.info("trigging " + eventName);
    let evObj = document.createEvent('Events');
    evObj.initEvent(eventName, true, false);
    targetElement.dispatchEvent(evObj);
  };

  ele.addEventListener("touchmove", () => {
    isMoved = true;
  });

  ele.addEventListener("touchend", (_event_) => {
    if(isMoved === false) {
      let _lazyCilckTimer_ = undefined;
      let _remove_timer_ = () => {
        if(_lazyCilckTimer_){
          console.info("remove timer " + _lazyCilckTimer_);
          clearTimeout(_lazyCilckTimer_);
          _lazyCilckTimer_ = undefined;
        }
      };
      _lazyCilckTimer_ = setTimeout(() => {
        console.info("remove " + triggingEventName + " handler for cleartimer");
        target.removeEventListener(triggingEventName, _remove_timer_);

        console.info("start " + mediateEventName + " event trigging.");
        eventDispatcher(target, mediateEventName);
      }, timerInterval);

      target.addEventListener(triggingEventName, _remove_timer_);
    }
    isMoved = false;
  });

  ele.addEventListener(mediateEventName, () => eventDispatcher(target, triggingEventName) );
}


// iOS for iframe does not trigger click event with history back
let as = document.querySelectorAll("a");
as.forEach((ele) => addLazyClick(ele));


// for debug
let attachEventHandler = (ele) => {
  let _attachEventHandler = (_ele_, _name_, _func_) => _ele_.addEventListener(_name_, _func_);
  let _checkEventTrigged = (_name_) => (__e__) => {
    //console.info(__e__);
    console.info(_name_ + " event is triggered");
  };
  let _event_list_ = ["click", /*"dbclick",*/
                    /*"mouseenter","mouseleave","mousemove","mouseout","mouseover",*/"mouseup","mousedown",
                    "touchcancel","touchend",/*"touchmove",*/"touchstart",
                    "lazy-click"];

  _event_list_.forEach((_event_name_) => {
    _attachEventHandler(ele, _event_name_, _checkEventTrigged(_event_name_));
  })
};
as.forEach(attachEventHandler);


