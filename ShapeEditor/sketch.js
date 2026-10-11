// ToDo:
// [ ] Multi select - 
    // [X] Drag Select
    // [X] move
    // [ ] copy/delete/insert between
// [ ] 5x3 helper frame for sizing help
// [X] Floating point scale from -32 to + 32 to match matrix pixels
// [ ] Flipping only flips selecte nodes (or all if non selected)
//     [ ] Flip with ALT key presed makes copy of flipped nodes
// [X] Load image as reference for tracing
//     [ ] Trace image scale with ALT + mousewheel
//     [ ] Trace image shift with ALT + arrows

var mX,mY;

var mXPressed,mYPressed;
var mXReleased,mYReleased;
var draggedIndex = -1;
var curShapeIndex = 0;
var is3D = false;

// for nearestnode
var NN_DELAY = 10;
var nearest_node_flash_timer = NN_DELAY;
var nearest_node_flash_state = true;

var deadCenterX, deadCenterY;

var undoBuffer = [];
var undoIndex = -1;

var traceImage = null;

var updateScreen = true;

// array of verts - x,y positions
class vert
{
  constructor( x,y, shapeIndex )
  {
    this.x = x;
    this.y = y;
    this.shapeIndex = shapeIndex;
    this.selected = false;
  }
};

var theVerts = [];
var numVerts = 0;
var outVerts = [];

var numShapes = 0;

var centerTrimX = 0;
var centerTrimY = 0;

var copybutton,clearbutton,centerbutton;
var button3D,button2D,buttonThickness;
var centerButton;
var buttonFlipH, buttonFlipV;
var buttonAlignHorizontal, buttonAlignVertical;
var buttonUndo, buttonRedo;
var thicknessSlider;

var lastClickPos = [];

function debugText()
{
  push();
  noStroke();
  fill(0,2255,0);
  text("Undo Index " + undoIndex,5,700);
  // text("LastClickPos [" + lastClickPos[0] +","+lastClickPos[1]+"]",5,720);
  var [snx_max, snx_min] = screenPosToNodePos([sx_max,sx_min]);
  var [sny_max, sny_min] = screenPosToNodePos([sy_max,sy_min]);
  text(`BBox Screen: ${sx_max-sx_min} x ${sy_max-sy_min}, Node :${snx_max-snx_min} x ${sny_max-sny_min}`,5,720);

  // show contents of undo buffer on the right
  // var ubTop = 300;
  // for( var ui = 0; ui < undoBuffer.length; ui++ )
  // {
  //   text( undoBuffer
  
  pop();
}

// function copyVerts( fromVerts, toVerts )
// {
//   toVerts = [];
//   for( var i = 0; i < fromVerts.length; i++ )
//   {
//     var nv = new vert();
//     nv.x = fromVerts[i].x;
//     nv.y = fromVerts[i].y;
//     nv.selected = fromVerts[i].selected;
//     nv.shapeIndex = fromVerts[i].shapeIndex;
//     toVerts.push(nv);
//   }
// }

function undo()
{
  if( undoIndex > 0 )
  {
    undoIndex--;
  }
  // move back in the array if possible
  //theVerts = [...undoBuffer[undoIndex]];
  // copyVerts( undoBuffer[undoIndex], theVerts );
  theVerts = JSON.parse(JSON.stringify(undoBuffer[undoIndex]));
  curShapeIndex = 0;
  // loadShape(theVerts);
}

function redo()
{
  if( undoIndex < undoBuffer.length-1 )
  {
    undoIndex++;
  }
  // move up the next entry
  // theVerts = [...undoBuffer[undoIndex]];
  // copyVerts( undoBuffer[undoIndex], theVerts );
  theVerts = JSON.parse(JSON.stringify(undoBuffer[undoIndex]));
  curShapeIndex = 0;
  // loadShape(theVerts);
}

var MAX_UNDO = 50;

var dragMode = "DRAG_NONE";

function saveState()
{
  // Do we need to clip the buffer
  if( undoBuffer.length >= MAX_UNDO )
  {
    undoBuffer.splice(0,1);
  }
  
  // undoBuffer.push( [...theVerts]  ); // copy
  // copyVerts( theVerts, undoBuffer[undoIndex] );
  undoBuffer.push( JSON.parse(JSON.stringify(theVerts)) );
  
  undoIndex = undoBuffer.length-1;
}

function loadShape( shape, dont_center = false )
{
  // shape will be an array containing arrays with x,y,and shape index
  theVerts = []; // clear current verts
  numVerts = 0;

  // console.log("Loading shape with " + shape.length + " lines" );
  for( var i = 0; i < shape.length; i++ )
  {
    var s = shape[i];
    // console.log( "Shape index " + i + " x=" + s[0] + ", y="+s[1] + ", index="+s[2] );
    // theVerts.push( new vert(float(s[0]),float(s[1]),int(s[2])) ); 
    theVerts.push( new vert((s[0]),(s[1]),int(s[2])) ); 
  }
  draw(); // important! Sets vars for center()
  if( !dont_center )
  {
    center();
  }
  
  curShapeIndex = 0;
  saveState();
}

function drawShapeFromKey( k )
{
  for( var i = 0; i < keyToShapeList.length; i++ )
  {
    var p = keyToShapeList[i];
    if( p[0] == k )
    {
      // console.log("Found key " + p[0],". Loading shape " + p[1] + ". object is " + p);
      loadShape( p[1], true );
      return true;
    }
  }

  return false; // nothing found for specified key
}


var typingMode = false;

function copyToClipboard (str) {
   // Create new element
   var el = document.createElement('textarea');
   // Set value (string to be copied)
   el.value = str;
   // Set non-editable to avoid focus and move outside of view
   el.setAttribute('readonly', '');
   el.style = {position: 'absolute', left: '-9999px'};
   document.body.appendChild(el);
   // Select text inside element
   el.select();
   // Copy text to clipboard
   document.execCommand('copy');
   // Remove temporary element
   document.body.removeChild(el);
}

function setButtons()
{
  if( is3D )
  {
    button3D.hide();
    button2D.show();
    // buttonThickness.show();
    thicknessSlider.show();
    thicknessSlider.value(depth);
  }
  else
  {
    button2D.hide();
    button3D.show();
    // buttonThickness.hide();
    thicknessSlider.hide();
  }
}

var ICON_SIZE = 30;
var ICON_SPACING = 40;
var ICON_TOP = 250;

var checkLink; // trace image and grid link for move, scale, etc

function setup() {
  var c = createCanvas(600, 800);
  c.parent("griddiv");
  depth = 110;

  var traceinput = createFileInput(handeTraceImage);
  traceinput.position(250, 0);
  
  thicknessSlider = createSlider(2.5,50);
  thicknessSlider.position(5,315);
  thicknessSlider.size(300);
  thicknessSlider.value(depth);

  checkLink = createCheckbox("Link", true);
  checkLink.position( 190,0);
  checkLink.hide();
  
  copybutton = createImg('icons/akar-icons--copy.svg', 'Copy to clipboard');
  //createButton('Copy to Clipboard');
  copybutton.position(330 + ICON_SPACING*0,ICON_TOP);
  copybutton.size(ICON_SIZE,ICON_SIZE);
  copybutton.mousePressed( () => {
    var ta=select("#output"); 
    copyToClipboard(ta.value()); } );
  
  clearbutton = createImg('icons/ant-design--delete-twotone.svg','Delete');
    //createButton('Clear');
  clearbutton.position(330 + ICON_SPACING*1,ICON_TOP);
  clearbutton.size(ICON_SIZE,ICON_SIZE);
  clearbutton.mousePressed( () => {
    console.log("Clearing all verts");
    theVerts = [];
    curShapeIndex = 0;
    traceImage = null;
    draw();
  });
  
  button3D = createImg('icons/bx--cube.svg','3D');
  button3D.position(330 + ICON_SPACING*2,ICON_TOP);
  button3D.size(ICON_SIZE,ICON_SIZE);
  button3D.mousePressed( ()=>{
    is3D = true;
    setButtons();
  });
  button3D.hide();

  button2D = createImg('icons/material-symbols--2d-2-outline-rounded.svg','2D');
  button2D.position(330 + ICON_SPACING*3,ICON_TOP);
  button2D.size(ICON_SIZE,ICON_SIZE);
  button2D.mousePressed( ()=>{
    is3D = false; 
    setButtons();
  });

  centerButton = createImg('icons/carbon--center-square.svg','center');
  centerButton.position(330 + ICON_SPACING*4,ICON_TOP);
  centerButton.size(ICON_SIZE,ICON_SIZE);
  centerButton.mousePressed( ()=>{
    center();
    });
  
  buttonFlipH = createImg('icons/dashicons--image-flip-horizontal.svg', 'H Flip' );
  buttonFlipH.position(330 + ICON_SPACING*5,ICON_TOP);
  buttonFlipH.size(ICON_SIZE,ICON_SIZE);
  buttonFlipH.mousePressed( ()=>{
    flip(false);
    });
  // buttonFlipH.color('white');

  buttonFlipV = createImg('icons/dashicons--image-flip-vertical.svg', 'V Flip' );
  buttonFlipV.position(330 + ICON_SPACING*6,ICON_TOP);
  buttonFlipV.size(ICON_SIZE,ICON_SIZE);
  buttonFlipV.mousePressed( ()=>{
    flip(true);
    });

  buttonAlignHorizontal = createImg("icons/akar-icons--align-vertical-center.svg", "H Align");
  buttonAlignHorizontal.position(330 + ICON_SPACING*7,ICON_TOP);
  buttonAlignHorizontal.size(ICON_SIZE,ICON_SIZE);
  buttonAlignHorizontal.mousePressed( ()=>{
    align(true);
    });
  buttonAlignHorizontal.hide();

  buttonAlignVertical = createImg("icons/akar-icons--align-horizontal-center.svg", "V Align");
  buttonAlignVertical.position(330 + ICON_SPACING*8,ICON_TOP);
  buttonAlignVertical.size(ICON_SIZE,ICON_SIZE);
  buttonAlignVertical.mousePressed( ()=>{
    align(false);
    });
  buttonAlignVertical.hide();

  undoButton = createImg('icons/boxicons--undo.svg','center');
  undoButton.position(330 + ICON_SPACING*0,ICON_TOP + 40);
  undoButton.size(ICON_SIZE,ICON_SIZE);
  undoButton.mousePressed( ()=>{
    undo();
    });

  redoButton = createImg('icons/boxicons--redo.svg','center');
  redoButton.position(330 + ICON_SPACING*1,ICON_TOP + 40);
  redoButton.size(ICON_SIZE,ICON_SIZE);
  redoButton.mousePressed( ()=>{
    redo();
    });
  
  
  // buttonThickness = createImg('line_weight.svg', 'Thickness');
  // buttonThickness.position(440,278);
  // buttonThickness.mousePressed( ()=>{
  //   if( !keyIsDown(SHIFT) )
  //   {
  //     depth += 2.5;
  //     if( depth > 50 ) depth = 2.5;
  //   }
  //   else
  //   {
  //     depth -= 2.5;
  //     if( depth < 2.5 ) depth = 50;
  //   }
  // });
 
  setButtons();
}

function align( doVertical )
{
  var leftMost = -1;
  var topMost = -1;

  // find left and top most nodes
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( theVerts[i].selected )
    {
      if( leftMost == -1 ){ leftMost = i; }
      
      if( theVerts[i].x < theVerts[leftMost].x )
      {
        leftMost = i;
      }
      
      if( topMost == -1 ) { topMost = i; }
      
      if( theVerts[i].y < theVerts[topMost].y )
      {
        topMost = i;
      }
      
    }
  }
  
  
  // now move
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( theVerts[i].selected )
    {
      if( doVertical )
      {
        theVerts[i].y = theVerts[topMost].y;
      }
      else
      {
        theVerts[i].x = theVerts[leftMost].x;
      }
    }
  }
  saveState();
  
}

var sx_min, sx_max, sy_min, sy_max;
var traceImageOffsetX = 0;
var traceImageOffsetY = 0;

function draw() {
  background(20);
  depth = thicknessSlider.value();

  // draw crosshair
  stroke(255,0,0);
  strokeWeight(1);
  line( 250,300,350,300 );
  line( 300,250,300,350 );

  checkLink.hide();
  if( traceImage )
  {
    if( traceImageOriginalWidth && traceImageScale )
    {
      var tiw = traceImageOriginalWidth * traceImageScale;
      var tih = traceImageOriginalHeight * traceImageScale;
      var tixo = 300-(tiw/2); // tracImageOffsetX (need a better way to deal with scale here)
      var tiyo = 300-(tih/2);
      tint(255,128);
      image( traceImage, int(tixo), int(tiyo), int(tiw), int(tih) );
      // back to normal opacity
      noTint();
      checkLink.show();
    }
  }
  
  num_grid_dots = 64
  grid_dot_spacing = 600.0/num_grid_dots
  half_gds = grid_dot_spacing
  // Draw dot grid
  for( var y  = 0; y < num_grid_dots; y++ )
  {
    for( var x  = 0; x < num_grid_dots; x++ )
    {
      noStroke();
      fill(128,128,128,128);
      circle(grid_dot_spacing/2+x*grid_dot_spacing,
             grid_dot_spacing/2+y*grid_dot_spacing,5);
    }
  }

  // find nearest and partially highlight
  // mX = (int)((mouseX) /  50);
  // mY = (int)((mouseY) /  50);
  // mX = (-25 +  mouseX) / grid_dot_spacing;  //50.0;
  // mY = (-25 + mouseY) /  grid_dot_spacing; //50.0;
  var cmX = mouseX,cmY = mouseY;
  [mX,mY] = screenPosToNodePos([cmX,cmY]);
  
  fill(188,62,62);
  // circle(25+mX*50, 25+mY*50,8);
  circle( cmX,cmY, 8 );
  
  var xA = 0;
  var yA = 0;
  var startingShapeIndex = 0;
  
  for( var pass = 0; pass < 2; pass++ )
  {
    var si = -1;
    if( theVerts[0] ) si = theVerts[0].shapeIndex;

    for( var i = 0; i < theVerts.length; i++ )
    {
      noStroke();
      
      if( pass == 1 )
        fill(0,255,0);
      else
        fill(0,96,0);

      // draw selected box if appropriate
      if( theVerts[i].selected )
      {
        push();
        noFill();
        stroke(255,255,0);
        strokeWeight(2);
        drawingContext.setLineDash([3,3]);
        var [sbx,sby] = nodePosToScreenPos( [theVerts[i].x,theVerts[i].y] );
        // rect(18 + theVerts[i].x*50, 18+ theVerts[i].y*50, 
        //      14,14 );
        rect( sbx-7,sby-7.14,14 );
        pop();
      }
      
      // pass 0 are verts & lines that are not the current shape
      // pass 1 are the current shapes verts and lines
      if( (pass == 0 && theVerts[i].shapeIndex != curShapeIndex) ||
          (pass == 1 && theVerts[i].shapeIndex == curShapeIndex) )
      {
        // circle( 25 + theVerts[i].x*50, 25+ theVerts[i].y*50, 12 );
        // // draw vert number
        // text(i, 30 + theVerts[i].x*50, 20+ theVerts[i].y*50 );

        var dispX,dispY;
        [dispX,dispY] = nodePosToScreenPos( [theVerts[i].x, theVerts[i].y] );
        circle( dispX, dispY, 12 );
        // // draw vert number
        text(i, 5+dispX, -5 + dispY );

        
        xA += theVerts[i].x;
        yA += theVerts[i].y;

        if( i > 0 )
        {
          // currently selected shape is white, others are grey
          if( theVerts[i-1].shapeIndex == curShapeIndex )
            stroke(255);
          else
            stroke(96);
          // still on same shape?
          if( theVerts[i].shapeIndex == theVerts[i-1].shapeIndex )
          {
            var x; //  =  25 + theVerts[i].x * 50;
            var y; // =  25 + theVerts[i].y * 50;
            var x2; // = 25 + theVerts[i-1].x * 50;
            var y2; // = 25 + theVerts[i-1].y * 50;
            [x,y] = nodePosToScreenPos( [theVerts[i].x, theVerts[i].y] );
            [x2,y2] = nodePosToScreenPos( [theVerts[i-1].x, theVerts[i-1].y] );
            line(x,y,x2,y2);
          }
          else // current shape ended
          {
             // find starting shape index for current shape
            var ss = 0;
            for( var j = i-1; j>=0; j-- )
            {
              if( theVerts[j].shapeIndex != theVerts[i-1].shapeIndex )
              {
                ss = j+1;
                break;
              }
            }
             si = i;
          }
        } // vert index > 0
      } // pass filter
    } // vert loop
  } // pass loop
  // console.log("done\n\n");

  // draw actual center
  if( theVerts.length > 1 )
  {
    // Calc the bounding box
    var x_min=theVerts[0].x, x_max=theVerts[0].x, 
      y_min=theVerts[0].y, y_max=theVerts[0].y;
    
    for( var i = 1; i < theVerts.length; i++ )
    {
      var vx = theVerts[i].x;
      var vy = theVerts[i].y;
      if( vx < x_min ){ x_min = vx; }
      if( vx > x_max ){ x_max = vx; }
      
      if( vy < y_min ){ y_min = vy; }
      if( vy > y_max ){ y_max = vy; }
    }

    [sx_min,sx_max] = nodePosToScreenPos([x_min,x_max]);
    [sy_min,sy_max] = nodePosToScreenPos([y_min,y_max]);
    
    // draw the bounding box
    stroke(255,255,0,129);
    // line(25+x_min*50, 25+y_min*50, 25+x_max*50,  25+y_min*50);
    // line(25+x_min*50, 25+y_min*50, 25+x_min*50,  25+y_max*50);
    // line(25+x_max*50, 25+y_min*50, 25+x_max*50,  25+y_max*50);
    // line(25+x_min*50, 25+y_max*50, 25+x_max*50,  25+y_max*50);
    line(sx_min, sy_min, sx_max, sy_min);
    line(sx_min, sy_min, sx_min, sy_max);
    line(sx_max, sy_min, sx_max, sy_max);
    line(sx_min, sy_max, sx_max, sy_max);
    xA = x_min + (x_max-x_min)/2;
    yA = y_min + (y_max-y_min)/2;
    centerTrimX = xA;//-5.5;
    centerTrimY = yA;//-5.5;
    // pick center X/Y of bounding box
    // xA = (xA)/theVerts.length;
    // yA = (yA)/theVerts.length;
    noStroke();
    fill(0,0,255);
    // circle(25+xA*50,25+yA*50,12);
    var cx,cy;
    [cx,cy] = nodePosToScreenPos([xA,yA]);
    circle(cx,cy,12);
    deadCenterX = xA;
    deadCenterY = yA;
    
  }


  // draw selection box if any
  if( dragStart.length > 1 && dragEnd.length > 1 )
  {
    push();
    noFill();
    stroke(255,0,255);
    drawingContext.setLineDash([5,5]);
    // swap start and end if we need to
    var dw = dragEnd[0]-dragStart[0];
    var dh = dragEnd[1]-dragStart[1];

    if( dw > 0 && dh > 0 )
    {
      rect( dragStart[0], dragStart[1], dw, dh);
    }
    pop();


  }

  // set the buttons based on the num selected nodes
  if( numSelected > 1 )
  {
    buttonAlignHorizontal.show();
    buttonAlignVertical.show();
  }
  else
  {
    buttonAlignHorizontal.hide();
    buttonAlignVertical.hide();
  }    
  
  //noFill();
  stroke(0,255,255);
  fill(0,255,255);
  strokeWeight(1);
  text(curShapeIndex, 0,615);

  if( deadCenterX && deadCenterY )
  {
    var vx = deadCenterX;  //-5.5;
    var vy = deadCenterY;  //-5.5;
    if( abs(vx) < 0.1 && abs(vy) < 0.1 )
    {
      noStroke();
      fill(0,255,0);
      strokeWeight(1);
      text("OK !", 0,635);
    }
    else
    {
      noStroke();
      fill(255,0,0);
      strokeWeight(1);
      text("NOT CENTERED!", 0,635);
    }  
  }
  
  // stroke(255,255,255);
  fill(255,255,255);
  strokeWeight(1);
  noStroke();
  text(typingMode?"Typing Mode":"Normal Mode", 0,655);

  if( dragStart.length > 0 && dragEnd.length >  0 )
  {
    text( "Drag Start " + dragStart[0] + "," + dragStart[1] +
          " - " + dragEnd[0] + "," + dragEnd[1] + " (" 
          + (dragEnd[0]-dragStart[0]) + ","
          + (dragEnd[1]-dragStart[1] )+")"
          , 0, 680 );
  }
  
  // flash the nearest node (if any)
  // mX = ((-25+mouseX) / 50);
  // mY = ((-25+mouseY) / 50);

  [mX,mY] = screenPosToNodePos([mouseX,mouseY]);
  
  var ni = whichNode(mX,mY);
  if( ni != -1 )
  {
    nearest_node_flash_timer -= 1;
    if( nearest_node_flash_timer <= 0 )
    {
      nearest_node_flash_timer = NN_DELAY;
      nearest_node_flash_state = !nearest_node_flash_state;
    }

    noStroke();
    if( nearest_node_flash_state )
    {
      fill(255,0,0);
    }
    else
    {
      fill(255,255,255);
    }
    // circle( 25 + theVerts[ni].x*50, 25+ theVerts[ni].y*50, 12 );    
    var cx,cy;
    [cx,cy] = nodePosToScreenPos([theVerts[ni].x, theVerts[ni].y]);
    circle( cx,cy, 12 );
  }

  debugText();
  noLoop();
} // end of draw function

function whichNode(x,y)
{
  var ni = -1;
  var mydist = 9999999;
  for( var i = 0; i < theVerts.length; i++ )
  {
    var dx = abs(x-theVerts[i].x);
    var dy = abs(y-theVerts[i].y);
    var d = sqrt(dx*dx + dy*dy);
    // console.log("Distance from " + i + " is " + d );
    if( curShapeIndex == theVerts[i].shapeIndex )
    {
      if( d < 1 && d < mydist )
      {
        mydist = abs(d);
        ni = i; // closest so far
      }
    }
  }  
  return ni;
}


function dumpTheData( useTrim )
{
  // log( "dumpData called!");
  var ta = select("#output");
  var vertString = "verts = [\n  ";
  
  var outString = "";//"# Data\n\n";
  
  var oX = 0;
  var oY = 0;
  
  if( useTrim )
  {
    console.log( "Center trim is " + centerTrimX + "," + centerTrimY );
    oX -= centerTrimX;
    oY -= centerTrimY;
  }
  // Get all the verts (e.g. 
  var shapeIndex = -1;
  var startIndex = 0;
  var d = depth * 0.05;
  
  numVerts = theVerts.length;
  var numShapes = 0;
  var sic = -1;
  outVerts = [];
  for( var i=0; i < numVerts; i++ )
  {
    if( theVerts[i].shapeIndex != sic )
    {
      numShapes++;
      sic = theVerts[i].shapeIndex;
    }
    outVerts.push( theVerts[i] );
  }
  
  if( is3D )
  {
    for( var ic=0; ic < numVerts; ic++ )
    {
      outVerts.push( 
        new vert( theVerts[ic].x, 
                 theVerts[ic].y, 
                 theVerts[ic].shapeIndex + numShapes ) 
        );
    }  
  }  
  
  var dout = d;
  
  for( var v = 0; v < outVerts.length; v++ )
  {
    if( v >= theVerts.length ){ dout = d * -1; }
    vertString += "[" + 
      (outVerts[v].x+oX).toFixed(3) + "," + 
      (outVerts[v].y+oY) .toFixed(3)+ "," + outVerts[v].shapeIndex + "],"; 
      //dout.toFixed(3) + "],#"+v;
    if( is3D )
    {
      if( v < numVerts )
      {
          vertString += " ";
      }
      else
      {
          //vertString += " Back";
      }
    }
    vertString += "\n  ";
  }
  
  vertString += "]";
  // faceString = faceString.substring(0,faceString.length-1);
  // faceString += "," + startIndex + "],";
  // if( is3D )
  //       faceString += "# Back";
  
  // if 3D, finally connect all front nodes to back nodes
  // if( is3D )
  // {
  //   for( var i = 0; i < numVerts; i++ )
  //   {
  //     faceString += "\n\t[" + (i+numVerts) +"," + i + "],";
  //   }
  // }
  //   faceString += "\n\t]";
  
  outString += vertString;
  // outString += faceString;
  
  ta.value(outString);
}

function scaleNodes( amount )
{
  for( var i = 0; i < theVerts.length; i++ )
  {
    // if( numSelected != 0 && selected_only && theVerts[i].selected == false )
    // {
    //   continue;
    // }
    
    theVerts[i].x *= amount;
    theVerts[i].y *= amount;
  }
  dumpTheData(false);
  saveState();
}

function scroll(x,y,selected_only)
{
  // override selected only if NOTHING is selected
  var numSelected = 0;
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( theVerts[i].selected )
    {
      numSelected += 1;
    }
  }  
  
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( numSelected != 0 && selected_only && theVerts[i].selected == false )
    {
      continue;
    }
    
    theVerts[i].x += x;
    theVerts[i].y += y;
  }
  dumpTheData(false);
  saveState();
  if( checkLink.checked() )
  {
    traceImageOffsetX += (x/traceImageScale);
    traceImageOffsetY += (y/traceImageScale);
  }
  draw();
}

function center()
{
  // scroll( 5.5-deadCenterX, 5.5-deadCenterY, false );
  scroll( -deadCenterX, -deadCenterY, false );
}

function flip( vertical )
{
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( numSelected && !theVerts[i].selected )
    {
      // skip this node
      continue;
    }
    
    if( vertical )
    {
      theVerts[i].y *= -1;
    }
    else
    {
      theVerts[i].x *= -1;
    }
    
  }  
  saveState();
}

function keyPressed()
{
  if( keyIsDown(CONTROL) )
  {
    if( key == 'z' ) // Undo
    {
      undo();
    }
    else if( key == 'y' ) // redo
    {
      redo();
    }
  }
  
  if( typingMode )
  {
    if( drawShapeFromKey(key) )
    { 
      return; 
    }
  }

  if( key == '?' )
  {
    typingMode = !typingMode;
  }

  
  if( key == '=' )
  {
    curShapeIndex++;
  }
  
  if( key == '-' && curShapeIndex > 0 )
  {
    curShapeIndex--;
  }
  
  if( key == 's' )
  {
    console.log("About to dump data");
    dumpTheData(false);
  }
  
  if( key == 'S' )
  {
    console.log("About to dump data");
    dumpTheData(true);
  }
  
  // if( key == 'c' )
  // {
  //   center();
  // }

  var move_amount = 1;
  if( keyIsDown(SHIFT) )
  {
    move_amount = 0.1;
  }

  // console.log( "keyCode is " + keyCode );
  if( keyCode == 38 ) // These defs seeem to have broken recently UP_ARROW )
  {
    scroll(0,-move_amount, true);
  }
  
  if( keyCode == 40)  //DOWN_ARROW )
  {
    scroll(0,move_amount, true);
  }
  
  if( keyCode == 37 )  //LEFT_ARROW )
  {
    scroll(-move_amount,0, true);
  }
  
  if( keyCode == 39 )  //RIGHT_ARROW )
  {
    scroll(move_amount,0, true);
  }

  draw();
}

var dragStart = [];
var dragEnd = [];

function screenPosToNodePos(mousePos)
{
  // mouse goes from 0-600, we want -32 to 32
  return [ ((mousePos[0]/600)*64)-32,
           ((mousePos[1]/600)*64)-32 ]
}

function nodePosToScreenPos( nodePos )
{
  return [ ((nodePos[0]+32)/64.0)*600,
           ((nodePos[1]+32)/64.0)*600 ]
}

function mousePressed()
{
  // mXPressed = ((-25+mouseX) / 50);
  // mYPressed = ((-25+mouseY) / 50);

  [mXPressed,mYPressed] = screenPosToNodePos([mouseX,mouseY])
  
  var ni = whichNode(mXPressed,mYPressed);
  draggedIndex = ni;
  dragEnd = [];
  if( mouseX < 0 || mouseY < 0 ) return;
  dragStart = [mouseX,mouseY];
  dragMode = "DRAG_START";
  draw();
}
var nodeDS = [];
var nodeDE = [];

function mouseReleased()
{
  [mXReleased,mYReleased] = screenPosToNodePos([mouseX,mouseY])
  var ni = whichNode(mXReleased,mYReleased);
  draggedIndex = -1;

  dragStart = dragEnd = nodeDS = nodeDE = [];

  if( dragMode == "DRAGGING" )
  {
    saveState();
  }    
  
  dragMode = "DRAG_END";
  draw();
}

var draggingStartX = false;
var draggingStartY = false;
var numSelected = 0;

function mouseDragged()
{
  if( mouseX < 0 || mouseY < 0 ) return;

  if( !keyIsDown(SHIFT) ) 
  {
    // check for dragging a selection
    if( dragEnd.length == 0 )
    { 
      dragEnd = [mouseX, mouseY]; 
    }
  
    if( draggingStartX ) // dragging the start x
    {
      if( mouseX > dragEnd[0] ) // switch to dragging the end
      {
        draggingStartX = false;
        dragEnd[0] = mouseX;
      }
      else
      {
        dragStart[0] = mouseX;      
      }
    }
    else // draging end x
    {
      if( mouseX < dragStart[0] )
      {
        draggingStartX = true;
        dragStart[0] = mouseX;
      }
      else
      {
        dragEnd[0] = mouseX;
      }
    }
  
    if( draggingStartY ) // dragging the start y
    {
      if( mouseY > dragEnd[1] ) // switch to dragging the end
      {
        draggingStartY = false;
        dragEnd[1] = mouseY;
      }
      else
      {
        dragStart[1] = mouseY;
      }
    }
    else // draging end y
    {
      if( mouseY < dragStart[1] )
      {
        draggingStartY = true;
        dragStart[1] = mouseY;
      }
      else
      {
        dragEnd[1] = mouseY;
      }
    }
    
    // - convert to node coords
    nodeDS = screenPosToNodePos([dragStart[0],dragStart[1]])
    nodeDE = screenPosToNodePos([dragEnd[0],dragEnd[1]])
    
    
    numSelected = 0;
    // find and select all nodes inside this rectangle
    for( var i = 0; i < theVerts.length; i++ )
    {
      theVerts[i].selected = false;
      if( (theVerts[i].shapeIndex == curShapeIndex || keyIsDown(SHIFT) ) &&
          theVerts[i].x >= nodeDS[0] && theVerts[i].x <= nodeDE[0] &&
          theVerts[i].y >= nodeDS[1] && theVerts[i].y <= nodeDE[1] )
      {
        // ??? look at this
        theVerts[i].selected = true;
        if( theVerts[i].selected )
        { 
          numSelected += 1; 
        }
      }
    }
  
  } // need SHIFT key pressed to drag nodes
  else
  {
    [mXDragged, mYDragged] = screenPosToNodePos([mouseX,mouseY])
    
    var ni = whichNode(mXDragged,mYDragged);
    if( draggedIndex != -1 && theVerts[draggedIndex].shapeIndex == curShapeIndex  )
    {
      var dragDeltaX = theVerts[draggedIndex].x - mXDragged;
      var dragDeltaY = theVerts[draggedIndex].y - mYDragged;
      theVerts[draggedIndex].x = mXDragged;
      theVerts[draggedIndex].y = mYDragged;
  
      // if any other nodes are selected, drag them by the same amount
      for( var i = 0; i < theVerts.length; i++ )
      {
        if( i != draggedIndex )
        {
          if( theVerts[i].selected )
          {
            theVerts[i].x -= dragDeltaX;
            theVerts[i].y -= dragDeltaY;
          }
        }
      }
      dumpTheData(false);
    }
  }
  dragMode = "DRAGGING";
  draw();
}

function lastNodeInShape( sh )
{
  var nodeIndex = -1;
  for( var i = 0; i < theVerts.length; i++ )
  {
    if( theVerts[i].shapeIndex == sh )
    {
      nodeIndex = i+1;
    }
    else if( theVerts[i].shapeIndex == sh + 1 )
    {
       break;
    }
   }
  return nodeIndex;
}

function mouseWheel(event)
{
  var tis = traceImageScale;
  
  if( event.delta > 0 )
  {
    if( keyIsDown(SHIFT) )
    {
      scaleNodes(0.99);
      tis *= 0.99;
    }
    else
    {
      scaleNodes(0.9);
      tis *= 0.9;
    }
  }
  else
  {
    if( keyIsDown(SHIFT) )
    {
      scaleNodes(1.01);
      tis *= 1.01;
    }
    else
    {
      scaleNodes(1.1);
      tis *= 1.1;
    }
  }
  if( checkLink.checked() )
  {
    traceImageScale = tis;
  }
  draw();
}

function mouseClicked()
{
  var somethingChanged = false;
  // console.log("Mouse Clicked");
  lastClickPos = screenPosToNodePos([mouseX,mouseY])
  
  if( mouseX >= 0 && mouseX < 600 && mouseY >=0 && mouseY < 600 )
  {
    // if we didn't change selection between pressing and releasing
    // if( mXPressed == mXReleased && mYPressed == mYReleased )
    if( abs(mXPressed - mXReleased) < 1 && abs(mYPressed - mYReleased) < 1 )
    {
      var ni = whichNode( mXReleased, mYReleased );
      var last = lastNodeInShape(curShapeIndex);
      // console.log( "ni = " + ni + ", last = " + last );
      if( !keyIsDown(CONTROL) ) // CONTROL key (Delete) NOT pressed!
      {
        if( ni == -1 ) // no node in the current shape on this spot
        {
          // console.log("No node in current shape at " + mXReleased + "," +mYReleased );
          // push or splice?
          if( last != -1 )
          {
            // console.log( "inserting a new node at position " + last );
            theVerts.splice(last,0, new vert(mX,mY,curShapeIndex) );
            somethingChanged = true;
          }
          else
          {
            // console.log( "Pushing a new node at the end of the array" );
            theVerts.push( new vert(mX,mY,curShapeIndex) );
            somethingChanged = true;
          }
        }
        else
        {
          // deselect all other nodes
          if( !keyIsDown(SHIFT) )
          {
            for( var i = 0; i < theVerts.length; i++ )
            {
              if( ni != i )
              {
                theVerts[i].selected = false;
                somethingChanged = true;
              }
            }
          }
          // select (or toggle) this node
          theVerts[ni].selected = !theVerts[ni].selected;
          somethingChanged = true;
        }
      }      
      
      if( ni != -1 && theVerts[ni].shapeIndex == curShapeIndex && keyIsDown(CONTROL) )// asssume we want to delete that node
      {
        theVerts.splice(ni,1);
        somethingChanged = true;
      }
    }
  }
 dumpTheData(false);
  if( somethingChanged )
  {
    // console.log("Something changed!");
    saveState();
  }
  draw();
}

var depth = 2.5;

var traceImageScale = 1;
var traceImageOriginalWidth;
var traceImageOriginalHeight;

function handeTraceImage(file)
{
  // Check the p5.File's type.
  if (file.type === 'image') 
  {
    // Create an image using using the p5.File's data.
    loadImage( file.data, function(newimg){ 
      traceImage = newimg;
      traceImageOriginalWidth = traceImage.width;
      traceImageOriginalHeight = traceImage.height;
      traceImageScale = 600/traceImageOriginalWidth;
      
      var tiw = traceImageOriginalWidth * traceImageScale;
      var tih = traceImageOriginalHeight * traceImageScale;
      var tixo = traceImageOffsetX; //300-(tiw/2);
      var tiyo = traceImageOffsetY; //300-(tih/2);
      
      traceImageOffsetX = 300-(tiw/2);
      traceImageOffsetY = 300-(tih/2);
      
      draw();
    } );
  } 
  else 
  {
    traceImage = null;
  }
}

function sketch3D(p,data)
{
  p.setup = function(){
    var c = p.createCanvas(300,300, p.WEBGL);
    c.parent("3ddiv");
    p.background(128);

    var resetButton;
    resetButton = createButton('Reset rotation');
    resetButton.addClass('topbutton');
    resetButton.mousePressed(() => {
      p.resetMatrix();
      p.camera(0, 0, (height/2) / tan(PI/6), 0, 0, 0, 0, 1, 0);
    });
  };
  
  p.draw = function(){
    p.background(32);
    p.orbitControl();
    p.fill(255);
    p.stroke(255);
    
    var obj_scale = 4.6; //22;
    var passes = 2;
    if( !is3D )
    {
      passes = 1;
      depth = 0;
    }
    for( var s = 0; s < passes; s++ )
    {
      var startingShapeIndex = 0;
      p.push();
      p.translate(0,0,depth);
      depth *= -1;
      for( var i = 0; i < theVerts.length; i++ )
      {
        // var x = (theVerts[i].x-5.5)*obj_scale;
        // var y = (theVerts[i].y-5.5)*obj_scale;
        var x = (theVerts[i].x)*obj_scale;
        var y = (theVerts[i].y)*obj_scale;
        // p.circle(x,y,5);
        if( i > 0 )
        {
          if( theVerts[i].shapeIndex == theVerts[i-1].shapeIndex )
          {
            
            p.line(
              // (theVerts[i].x-5.5)*obj_scale,
              // (theVerts[i].y-5.5)*obj_scale,
              // (theVerts[i-1].x-5.5)*obj_scale,
              // (theVerts[i-1].y-5.5)*obj_scale
              (theVerts[i].x)*obj_scale,
              (theVerts[i].y)*obj_scale,
              (theVerts[i-1].x)*obj_scale,
              (theVerts[i-1].y)*obj_scale
            );
          
          }
          else
          {
            /*
            p.line(
              (theVerts[i-1].x-5.5)*scale,
              (theVerts[i-1].y-5.5)*scale,
              (theVerts[startingShapeIndex].x-5.5)*scale,
              (theVerts[startingShapeIndex].y-5.5)*scale
            );
            */
            startingShapeIndex = i;
          }
        }
        /*
        if( i == theVerts.length-1 )
        {
            p.line(
              (theVerts[theVerts.length-1].x-5.5)*scale,
              (theVerts[theVerts.length-1].y-5.5)*scale,
              (theVerts[startingShapeIndex].x-5.5)*scale,
              (theVerts[startingShapeIndex].y-5.5)*scale
            );
        }*/
        
      }
      p.pop();
    }
    
    // draw the lines between front and back
    for( var i = 0; i < theVerts.length; i++ )
    {
      p.push();
      // p.translate((theVerts[i].x-5.5)*obj_scale,(theVerts[i].y-5.5)*obj_scale,0);
      p.translate((theVerts[i].x)*obj_scale,(theVerts[i].y)*obj_scale,0);
      p.rotateY(3.14159265/2);
      p.line(-depth,0,depth,0);
      p.pop();
    }
  };
}

new p5(sketch3D);


a_verts = [
  [-2.542,4.983,0],
  [-2.542,0.000,0],
  [-0.025,-4.983,0],
  [2.542,0.000,0],
  [2.542,4.983,0],
  [-2.542,0.101,1],
  [2.492,0.201,1],
  ]

b_verts = [
  [-2.695,5.002,0],
  [-2.695,-5.002,0],
  [1.503,-5.002,0],
  [2.644,-2.359,0],
  [-2.695,0.078,0],
  [2.695,1.166,0],
  [2.333,3.758,0],
  [0.674,5.002,0],
  [-2.695,5.002,0],
  ]

c_verts = [
  [2.691,2.704,0],
  [-0.247,5.304,0],
  [-2.691,2.704,0],
  [-2.691,-2.808,0],
  [-0.065,-5.304,0],
  [2.691,-2.808,0],
  ]

d_verts = [
  [-2.600,5.148,0],
  [-2.600,-5.148,0],
  [0.000,-5.148,0],
  [2.496,-2.496,0],
  [2.600,2.600,0],
  [0.000,5.096,0],
  [-2.600,5.148,0],
  ]

e_verts = [
  [2.626,5.226,0],
  [-2.678,5.226,0],
  [-2.678,-5.226,0],
  [2.678,-5.226,0],
  [-2.678,0.026,1],
  [-0.026,-0.026,1],
  ]

f_verts = [
  [-2.678,5.226,0],
  [-2.678,-5.226,0],
  [2.678,-5.226,0],
  [-2.678,0.026,1],
  [-0.026,-0.026,1],
  ]

g_verts = [
  [0.156,1.118,0],
  [2.756,2.366,0],
  [0.208,5.278,0],
  [-2.756,2.366,0],
  [-2.756,-2.522,0],
  [0.156,-5.278,0],
  [2.600,-2.522,0],
  ]


h_verts = [
  [-2.600,5.382,0],
  [-2.600,-5.278,0],
  [-2.548,0.182,1],
  [2.600,0.182,1],
  [2.600,-5.382,2],
  [2.600,5.278,2],
  ]

i_verts = [
  [0.156,5.278,0],
  [0.156,-5.174,0],
  [-2.418,-5.278,1],
  [2.366,-5.278,1],
  [-2.418,5.200,2],
  [2.418,5.200,2],
  ]

j_verts = [
  [-2.782,-5.148,0],
  [2.782,-5.148,0],
  [-0.026,-5.148,1],
  [1.014,2.496,1],
  [-1.274,5.148,1],
  [-2.470,2.496,1],
  ]

k_verts = [
  [-2.548,5.174,0],
  [-2.548,-5.174,0],
  [-2.548,0.182,1],
  [2.548,-5.174,1],
  [-2.548,0.182,2],
  [2.548,5.174,2],
  ]

l_verts = [
  [-2.678,-5.200,0],
  [-2.678,5.200,0],
  [2.678,5.200,0],
  ]

m_verts = [
  [-2.574,5.148,0],
  [-2.574,-5.148,0],
  [0.026,0.364,0],
  [2.574,-5.148,0],
  [2.574,5.148,0],
  ]

n_verts = [
  [-2.548,5.200,0],
  [-2.548,-5.200,0],
  [2.548,5.200,0],
  [2.548,-5.200,0],
  ]

o_verts = [
  [-0.026,5.252,0],
  [-2.522,2.652,0],
  [-2.522,-2.392,0],
  [-0.026,-5.252,0],
  [2.522,-2.392,0],
  [2.522,2.652,0],
  [-0.026,5.200,0],
  ]

p_verts = [
  [-2.678,5.226,0],
  [-2.678,-5.226,0],
  [2.678,-2.470,0],
  [-2.678,0.078,0],
  ]

q_verts = [
  [-0.026,5.174,0],
  [-2.522,2.730,0],
  [-2.522,-2.314,0],
  [0.078,-5.174,0],
  [2.522,-2.314,0],
  [2.522,2.730,0],
  [-0.026,5.174,0],
  [2.522,5.174,1],
  [0.338,2.418,1],
  ]

r_verts = [
  [-2.665,5.213,0],
  [-2.665,-5.213,0],
  [2.665,-2.457,0],
  [-2.665,0.091,0],
  [-2.665,0.117,1],
  [2.665,5.213,1],
  ]

s_verts = [
  [-2.522,2.756,0],
  [-1.378,5.148,0],
  [1.378,5.148,0],
  [2.522,2.756,0],
  [2.522,0.624,0],
  [0.026,0.000,0],
  [-2.522,-0.572,0],
  [-2.522,-2.652,0],
  [-1.274,-5.096,0],
  [1.378,-5.148,0],
  [2.522,-2.652,0],
  ]

t_verts = [
  [-0.078,5.278,0],
  [-0.078,-5.278,0],
  [-2.392,-5.278,1],
  [2.392,-5.278,1],
  ]

u_verts = [
  [-2.522,-5.226,0],
  [-2.574,5.226,0],
  [2.574,5.226,0],
  [2.574,-5.226,0],
  ]

v_verts = [
  [-2.522,-5.122,0],
  [-0.026,5.122,0],
  [2.522,-5.122,0],
  ]

w_verts = [
  [-2.574,-5.226,0],
  [-2.574,5.226,0],
  [0.130,-0.130,0],
  [2.574,5.226,0],
  [2.574,-5.226,0],
  ]

x_verts = [
  [-2.652,5.200,0],
  [2.652,-5.200,0],
  [-2.652,-5.200,1],
  [2.652,5.200,1],
  ]

y_verts = [
  [-2.756,-5.200,0],
  [0.000,0.156,0],
  [2.756,-5.200,0],
  [0.000,0.208,1],
  [0.000,5.200,1],
  ]

z_verts = [
  [-2.678,-5.226,0],
  [2.678,-5.226,0],
  [-2.678,5.226,0],
  [2.678,5.226,0],
  ]

num_1_verts = [
  [0.078,5.252,0],
  [0.078,-5.252,0],
  [-2.626,-2.444,0],
  [-2.626,5.252,1],
  [2.626,5.252,1],
  ]

num_2_verts = [
  [-2.574,-2.041,0],
  [-1.118,-5.057,0],
  [1.326,-5.109,0],
  [2.574,-2.353,0],
  [2.574,0.065,0],
  [-2.054,1.573,0],
  [-2.574,5.109,0],
  [2.574,5.109,0],
  ]

num_3_verts = [
  [-2.522,-5.226,0],
  [2.730,-5.226,0],
  [2.730,5.226,0],
  [-2.730,5.226,0],
  [2.730,0.026,1],
  [0.026,0.026,1],
  ]

num_4_verts = [
  [-2.626,-5.174,0],
  [-2.626,-0.026,0],
  [2.626,-0.026,0],
  [2.626,-5.174,1],
  [2.626,5.174,1],
  ]

num_5_verts = [
  [2.600,-5.226,0],
  [-2.600,-5.226,0],
  [-2.600,-0.130,0],
  [2.600,-0.130,0],
  [2.600,5.226,0],
  [-2.600,5.226,0],
  ]


num_6_verts = [
  [2.600,-5.226,0],
  [-2.600,-5.226,0],
  [-2.600,-0.130,0],
  [2.600,-0.130,0],
  [2.600,5.226,0],
  [-2.600,5.226,0],
  [-2.600,-0.130,1],
  [-2.600,5.226,1],
  ]

num_7_verts = [
  [-2.756,-5.304,0],
  [2.756,-5.304,0],
  [0.000,5.304,0],
  ]

num_8_verts = [
  [0.104,5.148,0],
  [-2.652,2.184,0],
  [2.652,-3.016,0],
  [0.104,-5.148,0],
  [-2.652,-3.016,0],
  [2.652,2.184,0],
  [0.104,5.148,0],
  ]

num_9_verts = [
  [2.574,5.174,0],
  [2.574,-5.174,0],
  [-2.574,-5.174,0],
  [-2.574,-0.182,0],
  [2.574,-0.182,0],
  ]

num_0_verts = [
  [2.522,5.168,0],
  [2.522,-5.168,0],
  [-2.522,-5.168,0],
  [-2.522,5.168,0],
  [2.522,5.168,0],
  [2.522,-5.168,1],
  [-2.522,5.168,1],
  ]

symbol_exclaimation_verts = [
  [0.000,-5.538,0],
  [0.000,1.794,0],
  [0.000,4.394,1],
  [0.000,5.538,1],
  ]

symbol_dollar_verts = [
  [-2.522,2.834,0],
  [-2.522,4.836,0],
  [2.522,4.836,0],
  [2.522,-0.130,0],
  [0.026,-0.130,0],
  [-2.522,-0.130,0],
  [-2.522,-5.096,0],
  [2.522,-5.096,0],
  [2.522,-2.730,0],
  [0.104,-6.344,1],
  [0.000,6.344,1],
  ]

symbol_equals_verts = [
  [-2.522,-1.352,0],
  [2.574,-1.352,0],
  [-2.574,1.352,1],
  [2.574,1.300,1],
  ]

symbol_at_verts = [
  [2.678,4.992,0],
  [0.182,4.992,0],
  [-2.678,2.756,0],
  [-2.678,0.052,0],
  [-2.678,-2.340,0],
  [-0.078,-4.992,0],
  [1.586,-4.992,0],
  [2.522,-2.912,0],
  [2.418,2.132,0],
  [-0.234,2.132,0],
  [-0.182,-1.352,0],
  [1.430,-1.352,0],
  [2.418,2.132,0],
  ]

symbol_hash_verts = [
  [-2.626,-1.248,0],
  [2.470,-1.248,0],
  [-2.574,1.040,1],
  [2.626,1.040,1],
  [-1.326,-2.444,2],
  [-1.326,2.236,2],
  [1.274,-2.340,3],
  [1.274,2.444,3],
  ]

symbol_percent_verts = [
  [-3.874,-5.018,0],
  [-3.874,-2.418,0],
  [-1.326,-2.418,0],
  [-1.274,-5.018,0],
  [-3.874,-5.018,0],
  [1.326,2.626,1],
  [1.326,5.018,1],
  [3.874,5.018,1],
  [3.874,2.626,1],
  [1.326,2.626,1],
  [-3.874,5.018,2],
  [3.874,-5.018,2],
  ]

symbol_caret_verts = [
  [-2.542,0.000,0],
  [-0.025,-4.983,0],
  [2.542,0.000,0],
  ]

symbol_ampersand_verts = [
  [2.444,0.702,0],
  [0.000,4.862,0],
  [-2.444,3.094,0],
  [-2.444,0.702,0],
  [1.456,-2.730,0],
  [0.000,-4.862,0],
  [-1.560,-2.730,0],
  [2.444,4.862,0],
  ]

symbol_star_verts = [
  [-2.522,5.148,0],
  [2.522,-5.148,0],
  [2.522,5.148,1],
  [-2.522,-5.148,1],
  [0.026,-5.148,2],
  [0.026,5.148,2],
  [-2.522,0.000,3],
  [2.522,0.000,3],
  ]

symbol_leftparan_verts = [
  [1.300,5.148,0],
  [-1.300,2.652,0],
  [-1.300,-2.392,0],
  [1.300,-5.148,0],
  ]

symbol_rightparan_verts = [
  [-1.300,5.148,0],
  [1.300,2.652,0],
  [1.300,-2.392,0],
  [-1.300,-5.148,0],
  ]

symbol_plus_verts = [
  [-2.600,0.000,0],
  [2.600,0.000,0],
  [0.000,-2.496,1],
  [0.052,2.496,1],
  ]

symbol_tilde_verts = [
  [-1.872,-4.002,0],
  [-0.624,-5.198,0],
  [0.364,-4.002,0],
  [1.872,-5.198,0],
  ]

symbol_backtick_verts = [
  [1.274,-5.204,0],
  [-1.274,-7.596,0],
  ]

symbol_doublequote_verts = [
  [-1.274,-5.244,0],
  [-1.274,-2.956,0],
  [1.274,-5.244,1],
  [1.274,-2.956,1],
  ]

symbol_singlequote_verts = [
  [-0.026,-5.204,0],
  [0.026,-2.916,0],
  ]

symbol_squarebracketleft_verts = [
  [1.378,-5.226,0],
  [-1.378,-5.226,0],
  [-1.378,5.226,0],
  [1.378,5.226,0],
  ]

symbol_squarebracketright_verts = [
  [-1.378,-5.226,0],
  [1.378,-5.226,0],
  [1.378,5.226,0],
  [-1.378,5.226,0],
  ]

symbol_curlybracketleft_verts = [
  [2.548,-5.817,0],
  [-0.208,-5.817,0],
  [-0.208,-2.606,0],
  [-2.548,-0.422,0],
  [-0.208,2.334,0],
  [-0.208,5.818,0],
  [2.548,5.818,0],
  ]

symbol_curlybracketright_verts = [
  [-2.548,-5.817,0],
  [0.208,-5.817,0],
  [0.208,-2.606,0],
  [2.548,-0.422,0],
  [0.208,2.334,0],
  [0.208,5.818,0],
  [-2.548,5.818,0],
  ]

symbol_ibar_verts = [
  [0.000,-5.200,0],
  [0.000,5.200,0],
  ]

symbol_backslash_verts = [
  [-5.148,-5.122,0],
  [5.148,5.122,0],
  ]

symbol_forwardslash_verts = [
  [5.148,-5.122,0],
  [-5.148,5.122,0],
  ]

symbol_lessthan_verts = [
  [2.600,-5.018,0],
  [-2.600,-0.078,0],
  [2.600,5.018,0],
  ]

symbol_greaterthan_verts = [
  [-2.600,-5.018,0],
  [2.600,-0.078,0],
  [-2.600,5.018,0],
  ]

symbol_comma_verts = [
  [1.248,2.730,0],
  [1.300,5.174,0],
  [-1.300,7.670,0],
  ]

symbol_period_verts = [
  [1.248,2.730,0],
  [1.300,3.744,0],
  [0.676,3.796,0],
  [0.624,2.860,0],
  [1.352,2.808,0],
  ]

symbol_colon_verts = [
  [0.026,-3.744,0],
  [0.026,-1.456,0],
  [-0.026,1.456,1],
  [-0.026,3.744,1],
  ]

symbol_semicolon_verts = [
  [1.149,-3.939,0],
  [1.149,-1.651,0],
  [1.100,1.261,1],
  [-1.149,3.939,1],
  ]

var keyToShapeList = [
  [':', symbol_colon_verts],
  [';', symbol_semicolon_verts],
  [',', symbol_comma_verts],
  ['.', symbol_period_verts],
  ['<', symbol_lessthan_verts],
  ['>', symbol_greaterthan_verts],
  ['\\', symbol_backslash_verts],
  ['/', symbol_forwardslash_verts],
  ['|', symbol_ibar_verts],
  ['{', symbol_curlybracketleft_verts],
  ['}', symbol_curlybracketright_verts],
  ['[', symbol_squarebracketleft_verts],
  [']', symbol_squarebracketright_verts],
  ["'", symbol_singlequote_verts],
  ['"', symbol_doublequote_verts],
  ['`', symbol_backtick_verts],
  ['~', symbol_tilde_verts],
  ['+', symbol_plus_verts],
  [')', symbol_rightparan_verts],
  ['(', symbol_leftparan_verts],
  ['*', symbol_star_verts],
  ['&', symbol_ampersand_verts],
  ['^', symbol_caret_verts],
  ['%', symbol_percent_verts],
  ['#', symbol_hash_verts],
  ['@', symbol_at_verts],
  ['!',symbol_exclaimation_verts],
  ['$', symbol_dollar_verts],
  ['a',a_verts],
  ['b',b_verts],
  ['c',c_verts],
  ['d',d_verts],
  ['e',e_verts],
  ['f',f_verts],
  ['g',g_verts],
  ['h',h_verts],
  ['i',i_verts],
  ['j',j_verts],
  ['k',k_verts],
  ['l',l_verts],
  ['m',m_verts],
  ['n',n_verts],
  ['o',o_verts],
  ['p',p_verts],
  ['q',q_verts],
  ['r',r_verts],
  ['s',s_verts],
  ['t',t_verts],
  ['u',u_verts],
  ['v',v_verts],
  ['w',w_verts],
  ['x',x_verts],
  ['y',y_verts],
  ['z',z_verts],
  ['0',num_0_verts],
  ['1',num_1_verts],
  ['2',num_2_verts],
  ['3',num_3_verts],
  ['4',num_4_verts],
  ['5',num_5_verts],
  ['6',num_6_verts],
  ['7',num_7_verts],
  ['8',num_8_verts],
  ['9',num_9_verts],
];

bad_invader_verts = [
  [-19.339,16.051,0],
  [-19.339,22.293,0],
  [-25.303,22.293,0],
  [-25.303,16.051,0],
  [-19.339,16.051,0],
  [-19.339,11.370,0],
  [-25.303,11.370,0],
  [-25.303,5.016,0],
  [-30.430,5.016,0],
  [-30.430,-17.389,0],
  [-25.303,-17.389,0],
  [-25.303,-5.685,0],
  [-19.339,-5.685,0],
  [-19.339,-12.373,0],
  [-13.710,-12.373,0],
  [-13.710,-17.389,0],
  [-19.339,-17.389,0],
  [-19.339,-22.293,0],
  [-13.710,-22.293,0],
  [-13.710,-17.389,0],
  [-13.710,-17.389,0],
  [14.045,-17.389,0],
  [14.045,-22.293,0],
  [18.615,-22.293,0],
  [18.615,-17.389,0],
  [14.045,-17.389,0],
  [14.045,-12.373,0],
  [18.615,-12.373,0],
  [18.615,-5.685,0],
  [25.526,-5.685,0],
  [25.526,-17.389,0],
  [30.430,-17.389,0],
  [30.430,5.016,0],
  [25.526,5.016,0],
  [25.526,11.370,0],
  [18.615,11.370,0],
  [18.615,16.051,0],
  [25.526,16.051,0],
  [25.526,22.293,0],
  [18.615,22.293,0],
  [18.615,16.051,0],
  [-18.838,16.386,1],
  [-14.156,16.386,1],
  [-14.156,10.924,1],
  [13.265,10.924,1],
  [13.265,16.386,1],
  [19.618,16.386,1],
  [-13.710,-6.242,2],
  [-13.710,-0.334,2],
  [-8.360,-0.334,2],
  [-8.360,-6.242,2],
  [-13.710,-6.242,2],
  [13.710,-6.465,3],
  [8.471,-6.465,3],
  [8.471,-0.669,3],
  [13.710,-0.669,3],
  [13.710,-6.465,3],
  ]

name_verts = [
  [-30.207,25.511,0],
  [-30.323,-25.511,0],
  [-19.771,-25.279,0],
  [-14.089,-19.713,0],
  [-12.929,-14.959,0],
  [-13.973,-8.581,0],
  [-20.930,-2.551,0],
  [-20.930,0.116,0],
  [-17.336,3.131,0],
  [-13.161,7.073,0],
  [-13.277,18.901,0],
  [-17.336,23.771,0],
  [-30.207,25.511,0],
  [-24.873,-18.785,1],
  [-19.539,-19.365,1],
  [-19.771,-8.697,1],
  [-25.453,-8.233,1],
  [-24.873,-18.785,1],
  [-24.177,8.697,2],
  [-19.539,9.740,2],
  [-18.147,20.177,2],
  [-24.641,18.785,2],
  [-24.177,8.697,2],
  [-8.291,-7.653,3],
  [-0.754,-12.060,3],
  [5.044,-9.045,3],
  [6.436,5.334,3],
  [5.392,18.089,3],
  [0.174,23.192,3],
  [-5.624,21.104,3],
  [-8.291,-7.653,3],
  [-3.885,-2.087,4],
  [2.145,-0.812,4],
  [0.870,9.972,4],
  [-3.421,13.103,4],
  [-5.276,4.870,4],
  [-3.885,-2.087,4],
  [11.886,-22.728,5],
  [14.669,22.148,5],
  [27.076,22.496,5],
  [28.468,16.002,5],
  [30.323,10.784,5],
  [26.960,3.943,5],
  [20.235,5.102,5],
  [16.524,-11.944,5],
  [15.248,-22.728,5],
  [11.886,-22.728,5],
  [19.655,11.016,6],
  [25.685,8.929,6],
  [24.989,18.321,6],
  [19.655,18.321,6],
  [19.655,11.016,6],
  [-30.207,25.511,7],
  [-30.323,-25.511,7],
  [-19.771,-25.279,7],
  [-14.089,-19.713,7],
  [-12.929,-14.959,7],
  [-13.973,-8.581,7],
  [-20.930,-2.551,7],
  [-20.930,0.116,7],
  [-17.336,3.131,7],
  [-13.161,7.073,7],
  [-13.277,18.901,7],
  [-17.336,23.771,7],
  [-30.207,25.511,7],
  [-24.873,-18.785,8],
  [-19.539,-19.365,8],
  [-19.771,-8.697,8],
  [-25.453,-8.233,8],
  [-24.873,-18.785,8],
  [-24.177,8.697,9],
  [-19.539,9.740,9],
  [-18.147,20.177,9],
  [-24.641,18.785,9],
  [-24.177,8.697,9],
  [-8.291,-7.653,10],
  [-0.754,-12.060,10],
  [5.044,-9.045,10],
  [6.436,5.334,10],
  [5.392,18.089,10],
  [0.174,23.192,10],
  [-5.624,21.104,10],
  [-8.291,-7.653,10],
  [-3.885,-2.087,11],
  [2.145,-0.812,11],
  [0.870,9.972,11],
  [-3.421,13.103,11],
  [-5.276,4.870,11],
  [-3.885,-2.087,11],
  [11.886,-22.728,12],
  [14.669,22.148,12],
  [27.076,22.496,12],
  [28.468,16.002,12],
  [30.323,10.784,12],
  [26.960,3.943,12],
  [20.235,5.102,12],
  [16.524,-11.944,12],
  [15.248,-22.728,12],
  [11.886,-22.728,12],
  [19.655,11.016,13],
  [25.685,8.929,13],
  [24.989,18.321,13],
  [19.655,18.321,13],
  [19.655,11.016,13],
  ]

jw_verts = [
  [-8.545,-14.058,0],
  [-15.490,-20.342,0],
  [-15.270,-23.099,0],
  [-16.373,-26.187,0],
  [-19.460,-29.053,0],
  [-22.106,-30.045,0],
  [-24.863,-29.384,0],
  [-20.783,-24.864,0],
  [-26.075,-18.688,0],
  [-30.706,-22.768,0],
  [-31.037,-19.240,0],
  [-29.383,-16.153,0],
  [-26.627,-13.948,0],
  [-22.989,-12.956,0],
  [-20.563,-13.617,0],
  [-13.506,-6.450,0],
  [-14.829,-2.260,0],
  [-15.050,3.363,0],
  [-13.837,6.891,0],
  [-20.783,13.617,0],
  [-22.547,13.286,0],
  [-25.635,13.506,0],
  [-27.509,14.940,0],
  [-29.714,16.814,0],
  [-30.817,20.011,0],
  [-30.597,22.879,0],
  [-25.745,18.688,0],
  [-20.783,24.533,0],
  [-25.524,29.714,0],
  [-21.996,30.045,0],
  [-18.909,28.942,0],
  [-15.821,25.745,0],
  [-15.050,22.658,0],
  [-15.270,20.342,0],
  [-9.316,14.719,0],
  [-8.986,16.594,0],
  [-7.993,19.130,0],
  [-6.230,20.011,0],
  [-3.804,19.019,0],
  [-3.142,16.594,0],
  [-2.150,19.130,0],
  [0.386,19.902,0],
  [2.592,18.357,0],
  [2.812,16.263,0],
  [4.576,19.681,0],
  [7.112,19.791,0],
  [8.766,17.256,0],
  [8.324,15.160,0],
  [9.758,14.388,0],
  [15.381,20.011,0],
  [14.829,23.099,0],
  [16.483,26.296,0],
  [19.020,29.053,0],
  [22.217,30.045,0],
  [25.525,29.384,0],
  [20.453,24.863,0],
  [25.856,18.799,0],
  [31.037,23.099,0],
  [31.037,20.784,0],
  [29.605,17.256,0],
  [27.399,14.168,0],
  [24.202,13.396,0],
  [21.335,13.506,0],
  [14.169,7.002,0],
  [14.720,1.709,0],
  [14.720,-3.473,0],
  [13.506,-6.450,0],
  [20.894,-13.507,0],
  [24.643,-13.396,0],
  [27.620,-14.719,0],
  [29.825,-16.814,0],
  [31.037,-19.681,0],
  [30.707,-22.768,0],
  [26.076,-18.688,0],
  [20.783,-24.864,0],
  [24.974,-29.273,0],
  [21.886,-29.715,0],
  [19.129,-29.053,0],
  [16.814,-26.958,0],
  [15.271,-23.210,0],
  [15.381,-20.012,0],
  [8.215,-13.727,0],
  [4.024,-15.491,0],
  [0.276,-16.704,0],
  [-3.362,-16.042,0],
  [-8.545,-14.058,0],
  [-7.111,-3.363,1],
  [-9.096,-2.150,1],
  [-10.419,-0.276,1],
  [-10.419,3.803,1],
  [-8.324,5.788,1],
  [-7.001,3.142,1],
  [-3.914,1.929,1],
  [-2.039,-0.828,1],
  [-4.465,-3.032,1],
  [-7.111,-3.363,1],
  [6.561,-3.694,2],
  [4.245,-2.811,2],
  [2.812,-1.488,2],
  [2.592,0.826,2],
  [7.773,3.914,2],
  [7.994,6.009,2],
  [9.427,4.355,2],
  [10.640,0.937,2],
  [10.199,-1.268,2],
  [6.561,-3.694,2],
  [-0.055,5.457,3],
  [-1.378,7.773,3],
  [-1.378,10.971,3],
  [-0.276,9.206,3],
  [1.047,11.080,3],
  [1.269,7.663,3],
  [-0.055,5.457,3],
  ]